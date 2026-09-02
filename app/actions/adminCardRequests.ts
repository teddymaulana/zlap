"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendCardRequestQuotedEmail, sendCardRequestRejectedEmail } from "@/lib/email";
import type { CardRequest } from "@/lib/types";

const TOKEN_TTL_DAYS = 7;
const SITE_URL = "https://zlapcard.com";

export async function getCardRequests(): Promise<CardRequest[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("card_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function quoteCardRequest(
  requestId: string,
  price: number,
  snkrdunkUrl: string
): Promise<{ error?: string }> {
  const quotedPrice = Math.round(price);
  if (!quotedPrice || quotedPrice <= 0) return { error: "Enter a valid price" };

  const supabase = await createClient();

  const { data: request } = await supabase
    .from("card_requests")
    .select("id, customer_email, card_name, set_name, grade, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return { error: "Request not found" };
  if (request.status !== "pending") return { error: "This request has already been responded to" };

  const productName = [request.card_name, request.set_name, request.grade].filter(Boolean).join(" — ");

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({ name: productName })
    .select("id")
    .single();
  if (productError) return { error: productError.message };

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("card_requests")
    .update({
      status: "quoted",
      quoted_price: quotedPrice,
      snkrdunk_url: snkrdunkUrl.trim() || null,
      product_id: product.id,
      checkout_token: token,
      token_expires_at: expiresAt,
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (error) return { error: error.message };

  await sendCardRequestQuotedEmail({
    to: request.customer_email,
    cardName: productName,
    quotedPrice,
    checkoutUrl: `${SITE_URL}/store/requests/${token}`,
    expiresAt,
  });

  revalidatePath("/requests");
  return {};
}

export async function rejectCardRequest(requestId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("card_requests")
    .select("id, customer_email, card_name, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return { error: "Request not found" };
  if (request.status !== "pending") return { error: "This request has already been responded to" };

  const { error } = await supabase
    .from("card_requests")
    .update({ status: "rejected", responded_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return { error: error.message };

  await sendCardRequestRejectedEmail({ to: request.customer_email, cardName: request.card_name });

  revalidatePath("/requests");
  return {};
}
