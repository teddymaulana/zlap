"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendOfferApprovedEmail, sendOfferRejectedEmail } from "@/lib/email";
import type { Offer } from "@/lib/types";

const TOKEN_TTL_HOURS = 48;
const DEFAULT_DIRECT_PRICE_PCT = 1.15;
const SITE_URL = "https://zlapcard.com";

export type AdminOfferRow = Offer & {
  productName: string;
  productImageUrl: string | null;
  offerMinPrice: number | null;
  currentPrice: number | null;
};

export async function getOffers(): Promise<AdminOfferRow[]> {
  const supabase = await createClient();

  const { data: offers, error } = await supabase
    .from("offers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!offers || offers.length === 0) return [];

  const productIds = [...new Set(offers.map((o) => o.product_id))];
  const [{ data: products }, { data: batches }] = await Promise.all([
    supabase.from("products").select("id, name, image_url, offer_min_price").in("id", productIds),
    supabase
      .from("inventory_batches")
      .select("product_id, cost, direct_price")
      .eq("is_storefront_price", true)
      .in("product_id", productIds),
  ]);

  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const priceByProduct = new Map(
    (batches ?? []).map((b) => [b.product_id, b.direct_price ?? b.cost * DEFAULT_DIRECT_PRICE_PCT])
  );

  return offers.map((o) => {
    const product = productById.get(o.product_id);
    return {
      ...o,
      productName: product?.name ?? "Unknown product",
      productImageUrl: product?.image_url ?? null,
      offerMinPrice: product?.offer_min_price ?? null,
      currentPrice: priceByProduct.get(o.product_id) ?? null,
    };
  });
}

export async function approveOffer(offerId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: offer } = await supabase
    .from("offers")
    .select("id, product_id, customer_email, offered_price, status")
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return { error: "Offer not found" };
  if (offer.status !== "pending") return { error: "This offer has already been responded to" };

  const { data: product } = await supabase
    .from("products")
    .select("name, image_url")
    .eq("id", offer.product_id)
    .maybeSingle();

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("offers")
    .update({
      status: "approved",
      checkout_token: token,
      token_expires_at: expiresAt,
      responded_at: new Date().toISOString(),
    })
    .eq("id", offerId);
  if (error) return { error: error.message };

  await sendOfferApprovedEmail({
    to: offer.customer_email,
    productName: product?.name ?? "your item",
    productImageUrl: product?.image_url,
    offeredPrice: offer.offered_price,
    checkoutUrl: `${SITE_URL}/store/offers/${token}`,
    expiresAt,
  });

  revalidatePath("/offers");
  return {};
}

export async function rejectOffer(offerId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: offer } = await supabase
    .from("offers")
    .select("id, product_id, customer_email, status")
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return { error: "Offer not found" };
  if (offer.status !== "pending") return { error: "This offer has already been responded to" };

  const { data: product } = await supabase
    .from("products")
    .select("name")
    .eq("id", offer.product_id)
    .maybeSingle();

  const { error } = await supabase
    .from("offers")
    .update({ status: "rejected", responded_at: new Date().toISOString() })
    .eq("id", offerId);
  if (error) return { error: error.message };

  await sendOfferRejectedEmail({ to: offer.customer_email, productName: product?.name ?? "your item" });

  revalidatePath("/offers");
  return {};
}
