// Server-only: refreshes a product's saved pre-order price snapshot from
// SNKRDUNK (not a "use server" module — callers do their own auth: the
// admin action checks the staff session, the cron route its secret).
import type { SupabaseClient } from "@supabase/supabase-js";
import { snkrdunkApparelId } from "@/lib/snkrdunk";
import { fetchJpyToIdr, fetchPsa10 } from "@/lib/snkrdunkMarket";
import { computePoPrice, type PoMarkupType } from "@/lib/preorder";

type PoProductRow = {
  id: string;
  snkrdunk_url: string | null;
  po_markup_type: PoMarkupType;
  po_markup_value: number;
  po_price: number | null;
};

// Base = median of recent PSA 10 sales. A card with no recent PSA 10 sales
// gets no price (and so can't be pre-ordered) rather than a guess.
export async function refreshPoPriceSnapshot(
  db: SupabaseClient,
  product: PoProductRow
): Promise<{ price: number } | { error: string }> {
  const apparelId = snkrdunkApparelId(product.snkrdunk_url);
  if (!apparelId) return { error: "Save this product's SNKRDUNK link first" };

  let reference;
  let fxRate;
  try {
    [reference, fxRate] = await Promise.all([fetchPsa10(apparelId), fetchJpyToIdr()]);
  } catch (err) {
    console.error("[preorder-price]", product.id, err);
    return { error: "Couldn't reach SNKRDUNK or the exchange-rate feed — try again later" };
  }
  if (!reference.recentSold) return { error: "No recent PSA 10 sales on SNKRDUNK to price from" };

  const baseJpy = reference.recentSold.medianJpy;
  const price = computePoPrice(baseJpy, fxRate, product.po_markup_type, Number(product.po_markup_value));
  const now = new Date().toISOString();
  // Keep the old price whenever the market moves it, for the staff "price
  // went up" alert (lib/preorder.ts hasPoPriceIncrease).
  const changed = product.po_price !== null && Number(product.po_price) !== price;
  const { error } = await db
    .from("products")
    .update({
      po_base_jpy: baseJpy,
      po_fx_rate: fxRate,
      po_price: price,
      po_price_updated_at: now,
      ...(changed ? { po_price_previous: product.po_price, po_price_changed_at: now } : {}),
    })
    .eq("id", product.id);
  if (error) return { error: error.message };
  return { price };
}

export const PO_PRODUCT_COLUMNS = "id, snkrdunk_url, po_markup_type, po_markup_value, po_price";
