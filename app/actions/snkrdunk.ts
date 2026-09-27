"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PO_PRODUCT_COLUMNS, refreshPoPriceSnapshot } from "@/lib/preorderPricing";
import { snkrdunkApparelId } from "@/lib/snkrdunk";
import { fetchJpyToIdr, fetchPsa10, type Psa10Reference } from "@/lib/snkrdunkMarket";

export type { Psa10Reference };

export async function getSnkrdunkPsa10(productId: string): Promise<Psa10Reference | { error: string }> {
  // Server actions are public endpoints — without this check anyone could
  // use our server to query SNKRDUNK. Only admin has a Supabase Auth session.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: product, error } = await supabase
    .from("products")
    .select("snkrdunk_url")
    .eq("id", productId)
    .maybeSingle();
  if (error) return { error: error.message };

  const apparelId = snkrdunkApparelId(product?.snkrdunk_url);
  if (!apparelId) return { error: "Save this product's SNKRDUNK link first" };

  try {
    const [reference, jpyToIdr] = await Promise.all([
      fetchPsa10(apparelId),
      fetchJpyToIdr().catch(() => null),
    ]);
    return { ...reference, jpyToIdr };
  } catch (err) {
    console.error("[snkrdunk]", err);
    return { error: "Couldn't fetch from SNKRDUNK right now — use the link to check by hand" };
  }
}

// Admin "Refresh pre-order price now" — same snapshot the daily cron
// (app/api/cron/preorder-prices) writes, on demand.
export async function refreshPoPrice(productId: string): Promise<{ price: number } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: product, error } = await supabase
    .from("products")
    .select(PO_PRODUCT_COLUMNS)
    .eq("id", productId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!product) return { error: "Product not found" };

  const result = await refreshPoPriceSnapshot(supabase, product);
  if (!("error" in result)) {
    revalidatePath(`/zlap-adm/products/${productId}`);
    revalidatePath(`/products/${productId}`);
  }
  return result;
}

// Staff acknowledged the "pre-order price went up" alert for this product.
export async function dismissPoPriceAlert(productId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("products")
    .update({ po_price_alert_dismissed_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) return { error: error.message };
  revalidatePath(`/zlap-adm/products/${productId}`);
  revalidatePath("/zlap-adm/preorders");
  return {};
}
