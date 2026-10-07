"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentCustomerId } from "@/lib/customerAuth";
import type { CartItem } from "@/app/(storefront)/CartContext";

// Server-side copy of storefront carts (see the `carts` / `cart_adds` tables
// in schema.sql). Everything here is best-effort and called fire-and-forget
// from CartContext — a failed sync must never get in the way of shopping.
// Both tables are service-role only; the cart id is a random UUID minted in
// the browser, which is what keeps one shopper from touching another's row.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LINES = 100;

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Only the fields the cart actually needs back on restore — the client sends
// whatever is in localStorage, so don't store arbitrary extra keys.
function sanitizeLine(raw: CartItem): CartItem | null {
  if (!raw || typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  const qty = Math.floor(Number(raw.qty));
  if (!Number.isFinite(qty) || qty <= 0 || qty > 1000) return null;
  return {
    id: raw.id.slice(0, 80),
    productId: typeof raw.productId === "string" ? raw.productId.slice(0, 40) : undefined,
    isPreorder: raw.isPreorder ? true : undefined,
    poMaxQty: typeof raw.poMaxQty === "number" ? raw.poMaxQty : undefined,
    name: raw.name.slice(0, 300),
    sku: typeof raw.sku === "string" ? raw.sku.slice(0, 100) : null,
    image_url: typeof raw.image_url === "string" ? raw.image_url.slice(0, 1000) : null,
    price: typeof raw.price === "number" ? raw.price : null,
    qty,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === "string").slice(0, 30) : [],
    setLanguage: raw.setLanguage ?? null,
    isGift: false,
  };
}

function signature(items: Pick<CartItem, "id" | "qty">[]) {
  return items
    .map((i) => `${i.id}:${i.qty}`)
    .sort()
    .join(",");
}

export async function syncCart(cartId: string, rawItems: CartItem[]): Promise<void> {
  if (!UUID_RE.test(cartId) || !Array.isArray(rawItems)) return;
  try {
    const items = rawItems
      .filter((i) => i && !i.isGift)
      .slice(0, MAX_LINES)
      .map(sanitizeLine)
      .filter((i): i is CartItem => i !== null);
    const customerId = await getCurrentCustomerId();
    const service = serviceClient();

    const { data: existing } = await service
      .from("carts")
      .select("items, customer_id, converted_at")
      .eq("id", cartId)
      .maybeSingle();
    // An order was already placed from this cart — the browser should have
    // moved on to a fresh id; don't reopen it.
    if (existing?.converted_at) return;

    const changed = !existing || signature(existing.items ?? []) !== signature(items);
    // Signing out keeps the cart linked to whoever owned it; signing in
    // (re)links it to the current customer.
    const nextCustomerId = customerId ?? existing?.customer_id ?? null;
    if (!changed && nextCustomerId === (existing?.customer_id ?? null)) return;
    if (!existing && items.length === 0) return;

    const row: Record<string, unknown> = { id: cartId, customer_id: nextCustomerId };
    if (changed) {
      row.items = items;
      row.item_count = items.reduce((sum, i) => sum + i.qty, 0);
      row.subtotal = items.reduce((sum, i) => sum + (i.price ?? 0) * i.qty, 0);
      row.updated_at = new Date().toISOString();
      // New contents deserve their own reminder (the cron still limits each
      // customer to one reminder a week).
      row.reminder_sent_at = null;
    }
    const { error } = await service.from("carts").upsert(row);
    if (error) console.error("[carts] sync failed:", error.message);
  } catch (err) {
    console.error("[carts] sync threw:", err);
  }
}

export async function recordCartAdd(cartId: string, productId: string, isPreorder: boolean): Promise<void> {
  if (!UUID_RE.test(cartId) || !UUID_RE.test(productId)) return;
  try {
    const customerId = await getCurrentCustomerId();
    const { error } = await serviceClient()
      .from("cart_adds")
      .insert({ cart_id: cartId, product_id: productId, is_preorder: isPreorder, customer_id: customerId });
    if (error) console.error("[carts] add record failed:", error.message);
  } catch (err) {
    console.error("[carts] add record threw:", err);
  }
}

export async function markCartConverted(cartId: string, orderCode: string): Promise<void> {
  if (!UUID_RE.test(cartId)) return;
  try {
    const { error } = await serviceClient()
      .from("carts")
      .update({ converted_at: new Date().toISOString(), order_id: orderCode.slice(0, 100) })
      .eq("id", cartId)
      .is("converted_at", null);
    if (error) console.error("[carts] convert failed:", error.message);
  } catch (err) {
    console.error("[carts] convert threw:", err);
  }
}

// The reminder email's "View your cart" link — lets the customer pick the
// cart back up on whichever device they open the email on.
export async function getCartForRestore(cartId: string): Promise<CartItem[] | null> {
  if (!UUID_RE.test(cartId)) return null;
  const { data } = await serviceClient()
    .from("carts")
    .select("items, converted_at")
    .eq("id", cartId)
    .maybeSingle();
  if (!data || data.converted_at) return null;
  return (data.items ?? []) as CartItem[];
}

// The reminder email's unsubscribe link. Keyed by cart id (only ever sent to
// the cart owner's inbox) so it works without signing in.
export async function optOutOfCartReminders(cartId: string): Promise<{ error?: string }> {
  if (!UUID_RE.test(cartId)) return { error: "This link is invalid." };
  const service = serviceClient();
  const { data: cart } = await service.from("carts").select("customer_id").eq("id", cartId).maybeSingle();
  if (!cart?.customer_id) return { error: "This link is invalid or has expired." };
  const { error } = await service
    .from("customers")
    .update({ cart_reminders_opt_out: true })
    .eq("id", cart.customer_id);
  if (error) return { error: "Something went wrong — please try again." };
  return {};
}
