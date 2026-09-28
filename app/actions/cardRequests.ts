"use server";

import { headers } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentCustomerId } from "@/lib/customerAuth";
import { isAllowedReferenceLink, MAX_REQUEST_QTY, REFERENCE_LINK_ERROR } from "@/lib/cardRequests";
import { sendCardRequestReceivedEmail } from "@/lib/email";
import {
  chargeAndCreateOrder,
  type CheckoutBank,
  type CheckoutPaymentMethod,
  type CheckoutResult,
} from "@/app/actions/checkout";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Mirrors the PSA_GRADES dropdown in app/(storefront)/request/page.tsx — we're only
// taking PSA 9/10 requests for now, so reject anything else server-side too
// (the dropdown alone doesn't stop a direct call to this action).
const ALLOWED_GRADES = new Set(["PSA 10", "PSA 9"]);

// Anti-spam limits for the public request form. Every accepted request
// emails the address it was given, so a bot hammering the form is really
// using us to send mail to strangers — hence limits on both the sender (IP)
// and the recipient (email).
const MAX_PER_IP_PER_HOUR = 3;
const MAX_PER_EMAIL_PER_DAY = 3;
// A person takes longer than this to fill the form; a bot posting straight
// away doesn't.
const MIN_FILL_MS = 3000;

// Gmail ignores dots and anything after "+" in the local part, so
// "a.b.c+x@gmail.com" is the same inbox as "abc@gmail.com" — collapse those
// so dotted variants all count against one per-email limit.
function emailKey(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
  }
  return `${local.split("+")[0]}@${domain}`;
}

// Vercel sets x-forwarded-for itself (the client's IP first), so it can be
// trusted there; falls back to x-real-ip elsewhere.
async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
}

export async function submitCardRequest(params: {
  cardName: string;
  setName: string;
  grade: string;
  referenceUrl: string;
  notes: string;
  qty: number;
  name: string;
  email: string;
  phone: string;
  // Honeypot: a field hidden from people, so anything in it came from a bot.
  website?: string;
  // When the form was rendered (ms since epoch), for MIN_FILL_MS.
  startedAt?: number;
}): Promise<{ error?: string }> {
  // Bots get a fake success, so they have no signal to adapt to.
  if (params.website?.trim()) return {};
  if (!params.startedAt || Date.now() - params.startedAt < MIN_FILL_MS) return {};

  const cardName = params.cardName.trim();
  const grade = params.grade.trim();
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const phone = params.phone.trim();
  const qty = Math.max(1, Math.round(params.qty));

  if (!cardName) return { error: "Enter the card you're looking for" };
  if (!ALLOWED_GRADES.has(grade)) return { error: "We're only taking PSA 9 and PSA 10 requests for now" };
  if (!name || !email) return { error: "Name and email are required" };
  if (!isAllowedReferenceLink(params.referenceUrl)) return { error: REFERENCE_LINK_ERROR };
  if (qty > MAX_REQUEST_QTY) return { error: `You can request up to ${MAX_REQUEST_QTY} copies at a time` };

  const service = serviceClient();
  const customerId = await getCurrentCustomerId();
  const ip = await clientIp();
  const key = emailKey(email);

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [ipCount, emailCount] = await Promise.all([
    ip
      ? service
          .from("card_requests")
          .select("id", { count: "exact", head: true })
          .eq("submitter_ip", ip)
          .gte("created_at", hourAgo)
      : Promise.resolve({ count: 0, error: null }),
    service
      .from("card_requests")
      .select("id", { count: "exact", head: true })
      .eq("email_key", key)
      .gte("created_at", dayAgo),
  ]);
  if (ipCount.error) return { error: ipCount.error.message };
  if (emailCount.error) return { error: emailCount.error.message };
  if ((ipCount.count ?? 0) >= MAX_PER_IP_PER_HOUR || (emailCount.count ?? 0) >= MAX_PER_EMAIL_PER_DAY) {
    return { error: "You've sent a few requests already — please try again later." };
  }

  const { error } = await service.from("card_requests").insert({
    customer_id: customerId,
    customer_name: name,
    customer_email: email,
    customer_phone: phone || null,
    card_name: cardName,
    set_name: params.setName.trim() || null,
    grade,
    reference_url: params.referenceUrl.trim() || null,
    notes: params.notes.trim() || null,
    qty,
    submitter_ip: ip,
    email_key: key,
  });
  if (error) return { error: error.message };

  await sendCardRequestReceivedEmail({ to: email, cardName });

  return {};
}

export type CardRequestCheckoutInfo = {
  cardName: string;
  imageUrl: string | null;
  quotedPrice: number;
  qty: number;
  customerName: string | null;
  customerEmail: string;
};

export async function getCardRequestByToken(
  token: string
): Promise<CardRequestCheckoutInfo | { error: string } | null> {
  if (!token) return null;
  const service = serviceClient();

  const { data: request } = await service
    .from("card_requests")
    .select(
      "id, product_id, quoted_price, qty, status, token_expires_at, customer_name, customer_email, card_name"
    )
    .eq("checkout_token", token)
    .maybeSingle();
  if (!request) return null;

  if (request.status === "completed") return { error: "This request has already been paid for" };
  if (request.status !== "quoted") return { error: "This request link is no longer valid" };
  if (request.token_expires_at && new Date(request.token_expires_at) < new Date()) {
    await service.from("card_requests").update({ status: "expired" }).eq("id", request.id);
    return { error: "This request link has expired" };
  }

  const { data: product } = await service
    .from("products")
    .select("id, name, image_url")
    .eq("id", request.product_id)
    .maybeSingle();

  return {
    cardName: product?.name ?? request.card_name,
    imageUrl: product?.image_url ?? null,
    quotedPrice: request.quoted_price!,
    qty: request.qty,
    customerName: request.customer_name,
    customerEmail: request.customer_email,
  };
}

export async function createCardRequestOrderAndCharge(
  token: string,
  customer: { name: string; phone: string; address: string; email: string },
  paymentMethod: CheckoutPaymentMethod,
  bankCode: CheckoutBank = "bca"
): Promise<CheckoutResult> {
  const name = customer.name.trim();
  const phone = customer.phone.trim();
  const address = customer.address.trim();
  const email = customer.email.trim();
  if (!name || !phone || !address || !email) {
    return { error: "Name, phone, email, and address are required" };
  }

  const service = serviceClient();

  const { data: request } = await service
    .from("card_requests")
    .select("id, product_id, quoted_price, qty, status, token_expires_at")
    .eq("checkout_token", token)
    .maybeSingle();
  if (!request) return { error: "Request not found" };
  if (request.status === "completed") return { error: "This request has already been paid for" };
  if (request.status !== "quoted") return { error: "This request link is no longer valid" };
  if (request.token_expires_at && new Date(request.token_expires_at) < new Date()) {
    await service.from("card_requests").update({ status: "expired" }).eq("id", request.id);
    return { error: "This request link has expired" };
  }

  const { data: product } = await service
    .from("products")
    .select("id, name, image_url")
    .eq("id", request.product_id)
    .maybeSingle();
  if (!product) return { error: "This item is no longer available" };

  const lines = Array.from({ length: request.qty }, () => ({
    product_id: request.product_id as string,
    inventory_batch_id: null,
    price: request.quoted_price as number,
  }));

  const customerId = await getCurrentCustomerId();

  const { result, internalOrderId } = await chargeAndCreateOrder({
    service,
    lines,
    grossAmount: request.quoted_price! * request.qty,
    customer: { name, phone, address, email },
    paymentMethod,
    bankCode,
    customerId,
    buildEmailLines: async () => [
      {
        name: product.name,
        qty: request.qty,
        price: request.quoted_price!,
        imageUrl: product.image_url,
      },
    ],
  });

  if (internalOrderId) {
    await service
      .from("card_requests")
      .update({ status: "completed", order_id: internalOrderId })
      .eq("id", request.id);
  }

  return result;
}
