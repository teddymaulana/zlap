"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentCustomerId } from "@/lib/customerAuth";
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

// Mirrors the PSA_GRADES dropdown in app/store/request/page.tsx — we're only
// taking PSA 9/10 requests for now, so reject anything else server-side too
// (the dropdown alone doesn't stop a direct call to this action).
const ALLOWED_GRADES = new Set(["PSA 10", "PSA 9"]);

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
}): Promise<{ error?: string }> {
  const cardName = params.cardName.trim();
  const grade = params.grade.trim();
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const phone = params.phone.trim();
  const qty = Math.max(1, Math.round(params.qty));

  if (!cardName) return { error: "Enter the card you're looking for" };
  if (!ALLOWED_GRADES.has(grade)) return { error: "We're only taking PSA 9 and PSA 10 requests for now" };
  if (!name || !email) return { error: "Name and email are required" };

  const service = serviceClient();
  const customerId = await getCurrentCustomerId();

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
