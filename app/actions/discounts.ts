"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCustomerId } from "@/lib/customerAuth";
import type { Discount, DiscountType } from "@/lib/discounts";

type DiscountRow = {
  id: string;
  name: string;
  type: DiscountType;
  percentage: number | null;
  fixed_amount: number | null;
  free_product_id: string | null;
  is_active: boolean;
  code: string | null;
  stackable: boolean;
  requires_login: boolean;
  once_per_customer: boolean;
  discount_products: { product_id: string }[] | null;
};

function toDiscount(row: DiscountRow): Discount {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    percentage: row.percentage,
    fixedAmount: row.fixed_amount,
    freeProductId: row.free_product_id,
    isActive: row.is_active,
    productIds: (row.discount_products ?? []).map((p) => p.product_id),
    code: row.code,
    stackable: row.stackable,
    requiresLogin: row.requires_login,
    oncePerCustomer: row.once_per_customer,
  };
}

const DISCOUNT_SELECT =
  "id, name, type, percentage, fixed_amount, free_product_id, is_active, code, stackable, requires_login, once_per_customer, discount_products(product_id)";

export async function getDiscounts(): Promise<Discount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discounts")
    .select(DISCOUNT_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toDiscount);
}

export async function getDiscount(id: string): Promise<Discount | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discounts")
    .select(DISCOUNT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toDiscount(data) : null;
}

// Fetches every active discount with its assigned products, for the
// storefront's price computation (app/actions/storefront.ts) and cart/
// checkout's BOGO preview (CartContext.tsx, app/actions/checkout.ts). Runs
// on the service role since it's called from public storefront paths, same
// reasoning as priceByProductId — a discount's existence/amount isn't
// sensitive, but nothing here should depend on the visitor's own RLS access.
//
// Best-effort, same as getHeaderCopy in app/(storefront)/layout.tsx: a
// lookup failure here must never take down product browsing or checkout —
// it just falls back to no discounts rather than throwing, same as a gift
// silently getting dropped when its stock has run out.
export async function getActiveDiscounts(): Promise<Discount[]> {
  try {
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error } = await service
      .from("discounts")
      .select(DISCOUNT_SELECT)
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    return (data ?? []).map(toDiscount);
  } catch (err) {
    console.error("getActiveDiscounts failed, treating as no active discounts:", err);
    return [];
  }
}

// Mirrors app/actions/storefront.ts's fallback for batches with no manual
// direct_price.
const DEFAULT_DIRECT_PRICE_PCT = 1.15;

export type BogoFreeProduct = {
  id: string;
  name: string;
  image_url: string | null;
  // What this product would normally sell for, so the cart can show it
  // crossed out next to "Free" — same idea as app/actions/gwp.ts's
  // GiftCatalogItem.originalPrice.
  originalPrice: number | null;
};

// Every product that's the free reward of an active BOGO discount, for the
// cart's client-side preview (CartContext) to resolve an earned BOGO reward
// to a real product to display.
export async function getBogoFreeProductCatalog(): Promise<BogoFreeProduct[]> {
  const discounts = await getActiveDiscounts();
  const freeProductIds = [
    ...new Set(
      discounts.filter((d) => d.type === "bogo" && d.freeProductId).map((d) => d.freeProductId!)
    ),
  ];
  if (freeProductIds.length === 0) return [];

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const [{ data: products, error }, { data: batches, error: batchError }] = await Promise.all([
    service.from("products").select("id, name, image_url").in("id", freeProductIds),
    service
      .from("inventory_batches")
      .select("product_id, cost, direct_price, created_at")
      .in("product_id", freeProductIds)
      .order("created_at", { ascending: false }),
  ]);
  if (error) throw new Error(error.message);
  if (batchError) throw new Error(batchError.message);

  const priceByProductId = new Map<string, number>();
  for (const b of batches ?? []) {
    if (priceByProductId.has(b.product_id)) continue; // keep only the latest batch
    priceByProductId.set(b.product_id, b.direct_price ?? b.cost * DEFAULT_DIRECT_PRICE_PCT);
  }

  return (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    image_url: p.image_url,
    originalPrice: priceByProductId.get(p.id) ?? null,
  }));
}

// Whether the signed-in customer (if any) has already redeemed this
// once-per-customer discount — the same check createOrderAndCharge makes
// authoritatively at checkout, exposed here so the cart can reject an
// already-used code immediately instead of waiting until payment.
export async function hasRedeemedDiscount(discountId: string): Promise<boolean> {
  const customerId = await getCurrentCustomerId();
  if (!customerId) return false;

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await service
    .from("discount_redemptions")
    .select("id")
    .eq("discount_id", discountId)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

function parseDiscountForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "") as DiscountType;
  const percentageRaw = String(formData.get("percentage") ?? "").trim();
  const fixedAmountRaw = String(formData.get("fixed_amount") ?? "").trim();
  const freeProductId = String(formData.get("free_product_id") ?? "").trim();
  const isActive = formData.get("is_active") === "on";
  const productIds = formData.getAll("product_ids").map(String).filter(Boolean);
  const code = String(formData.get("code") ?? "").trim();
  const stackable = formData.get("stackable") === "on";
  const requiresLogin = formData.get("requires_login") === "on";
  const oncePerCustomer = formData.get("once_per_customer") === "on";

  if (!name) throw new Error("Name is required");
  if (!["percentage", "fixed", "bogo"].includes(type)) throw new Error("Invalid discount type");
  if (code && type === "bogo") throw new Error("Discount codes can't be used with a buy-one-get-free discount");
  // A code-triggered discount can target the whole cart instead of specific
  // products, so it's the only case allowed to skip product assignment.
  if (productIds.length === 0 && !code) {
    throw new Error(type === "bogo" ? "Pick at least one trigger product" : "Assign at least one product");
  }
  if (type === "percentage" && (!percentageRaw || Number(percentageRaw) <= 0)) {
    throw new Error("Enter a percentage greater than 0");
  }
  if (type === "fixed" && (!fixedAmountRaw || Number(fixedAmountRaw) <= 0)) {
    throw new Error("Enter a fixed amount greater than 0");
  }
  if (type === "bogo" && !freeProductId) {
    throw new Error("Pick the free product for this BOGO discount");
  }

  return {
    name,
    type,
    percentage: type === "percentage" ? Number(percentageRaw) : null,
    fixed_amount: type === "fixed" ? Number(fixedAmountRaw) : null,
    free_product_id: type === "bogo" ? freeProductId : null,
    is_active: isActive,
    code: code || null,
    stackable: code ? stackable : false,
    requires_login: code ? requiresLogin : false,
    once_per_customer: code ? oncePerCustomer : false,
    productIds,
  };
}

// Postgres unique_violation — thrown by the lower(code) unique index when
// another discount already uses this code.
function isDuplicateCodeError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "23505";
}

export async function createDiscount(formData: FormData) {
  const { productIds, ...fields } = parseDiscountForm(formData);

  const supabase = await createClient();
  const { data, error } = await supabase.from("discounts").insert(fields).select("id").single();
  if (error) throw new Error(isDuplicateCodeError(error) ? "That code is already in use" : error.message);

  if (productIds.length > 0) {
    const { error: linkError } = await supabase
      .from("discount_products")
      .insert(productIds.map((product_id) => ({ discount_id: data.id, product_id })));
    if (linkError) throw new Error(linkError.message);
  }

  revalidatePath("/zlap-adm/discounts");
  redirect(`/zlap-adm/discounts/${data.id}`);
}

export async function updateDiscount(discountId: string, formData: FormData) {
  const { productIds, ...fields } = parseDiscountForm(formData);

  const supabase = await createClient();
  const { error } = await supabase.from("discounts").update(fields).eq("id", discountId);
  if (error) throw new Error(isDuplicateCodeError(error) ? "That code is already in use" : error.message);

  // Simplest correct way to sync the assigned-products set: replace it
  // wholesale rather than diffing — these lists are short (a handful of
  // products per discount), so the extra round trip doesn't matter.
  const { error: deleteError } = await supabase
    .from("discount_products")
    .delete()
    .eq("discount_id", discountId);
  if (deleteError) throw new Error(deleteError.message);

  if (productIds.length > 0) {
    const { error: linkError } = await supabase
      .from("discount_products")
      .insert(productIds.map((product_id) => ({ discount_id: discountId, product_id })));
    if (linkError) throw new Error(linkError.message);
  }

  revalidatePath("/zlap-adm/discounts");
  revalidatePath(`/zlap-adm/discounts/${discountId}`);
}

export async function toggleDiscountActive(discountId: string, currentlyActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("discounts")
    .update({ is_active: !currentlyActive })
    .eq("id", discountId);
  if (error) throw new Error(error.message);

  revalidatePath("/zlap-adm/discounts");
  revalidatePath(`/zlap-adm/discounts/${discountId}`);
}

export async function deleteDiscount(discountId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("discounts").delete().eq("id", discountId);
  if (error) throw new Error(error.message);

  revalidatePath("/zlap-adm/discounts");
  redirect("/zlap-adm/discounts");
}
