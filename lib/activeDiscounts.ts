// Server-only on purpose — deliberately NOT a "use server" module. Every
// export of a "use server" file is a publicly callable endpoint, and this
// returns every active discount including its redemption code, so exposing
// it would let any visitor list all codes. Client code goes through
// getStorefrontDiscounts / redeemDiscountCode in app/actions/discounts.ts
// instead.
import { createClient as createServiceClient } from "@supabase/supabase-js";
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
  badge_text: string | null;
  discount_products: { product_id: string }[] | null;
};

export function toDiscount(row: DiscountRow): Discount {
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
    badgeText: row.badge_text,
  };
}

export const DISCOUNT_SELECT =
  "id, name, type, percentage, fixed_amount, free_product_id, is_active, code, stackable, requires_login, once_per_customer, badge_text, discount_products(product_id)";

// Fetches every active discount with its assigned products, for the
// storefront's price computation (app/actions/storefront.ts) and cart/
// checkout's BOGO preview (CartContext.tsx, app/actions/checkout.ts). Runs
// on the service role since it's called from public storefront paths, same
// reasoning as priceByProductId — nothing here should depend on the
// visitor's own RLS access.
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
