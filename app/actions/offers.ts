"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentCustomerId } from "@/lib/customerAuth";
import { sendOfferReceivedEmail } from "@/lib/email";
import {
  chargeAndCreateOrder,
  type CheckoutBank,
  type CheckoutPaymentMethod,
  type CheckoutResult,
} from "@/app/actions/checkout";

const DEFAULT_DIRECT_PRICE_PCT = 1.15;

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function currentStorefrontBatch(service: ReturnType<typeof serviceClient>, productId: string) {
  const { data } = await service
    .from("inventory_batch_availability")
    .select("id, cost, direct_price, available")
    .eq("product_id", productId)
    .eq("is_storefront_price", true)
    .maybeSingle();
  if (!data) return null;
  return { ...data, price: data.direct_price ?? data.cost * DEFAULT_DIRECT_PRICE_PCT };
}

export async function submitOffer(params: {
  productId: string;
  offeredPrice: number;
  qty: number;
  name: string;
  email: string;
}): Promise<{ error?: string }> {
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const qty = Math.max(1, Math.round(params.qty));
  const offeredPrice = Math.round(params.offeredPrice);

  if (!name || !email) return { error: "Name and email are required" };
  if (!offeredPrice || offeredPrice <= 0) return { error: "Enter a valid offer price" };

  const service = serviceClient();

  const { data: product } = await service
    .from("products")
    .select("id, name, offers_enabled")
    .eq("id", params.productId)
    .maybeSingle();
  if (!product?.offers_enabled) return { error: "Offers aren't available for this item" };

  const batch = await currentStorefrontBatch(service, params.productId);
  if (!batch) return { error: "This item isn't available right now" };
  if (qty > batch.available) return { error: "Not enough stock available for that quantity" };
  if (offeredPrice >= batch.price) {
    return { error: "Your offer should be lower than the current price" };
  }

  const customerId = await getCurrentCustomerId();

  const { error } = await service.from("offers").insert({
    product_id: params.productId,
    customer_id: customerId,
    customer_name: name,
    customer_email: email,
    offered_price: offeredPrice,
    qty,
  });
  if (error) return { error: error.message };

  await sendOfferReceivedEmail({ to: email, productName: product.name, offeredPrice });

  return {};
}

export type OfferCheckoutInfo = {
  productId: string;
  productName: string;
  imageUrl: string | null;
  offeredPrice: number;
  qty: number;
  customerName: string | null;
  customerEmail: string;
};

export async function getOfferByToken(token: string): Promise<OfferCheckoutInfo | { error: string } | null> {
  if (!token) return null;
  const service = serviceClient();

  const { data: offer } = await service
    .from("offers")
    .select("id, product_id, offered_price, qty, status, token_expires_at, customer_name, customer_email")
    .eq("checkout_token", token)
    .maybeSingle();
  if (!offer) return null;

  if (offer.status === "completed") return { error: "This offer has already been paid for" };
  if (offer.status !== "approved") return { error: "This offer link is no longer valid" };
  if (offer.token_expires_at && new Date(offer.token_expires_at) < new Date()) {
    await service.from("offers").update({ status: "expired" }).eq("id", offer.id);
    return { error: "This offer link has expired" };
  }

  const { data: product } = await service
    .from("products")
    .select("id, name, image_url")
    .eq("id", offer.product_id)
    .maybeSingle();
  if (!product) return { error: "This product is no longer available" };

  return {
    productId: product.id,
    productName: product.name,
    imageUrl: product.image_url,
    offeredPrice: offer.offered_price,
    qty: offer.qty,
    customerName: offer.customer_name,
    customerEmail: offer.customer_email,
  };
}

export async function createOfferOrderAndCharge(
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

  const { data: offer } = await service
    .from("offers")
    .select("id, product_id, offered_price, qty, status, token_expires_at")
    .eq("checkout_token", token)
    .maybeSingle();
  if (!offer) return { error: "Offer not found" };
  if (offer.status === "completed") return { error: "This offer has already been paid for" };
  if (offer.status !== "approved") return { error: "This offer link is no longer valid" };
  if (offer.token_expires_at && new Date(offer.token_expires_at) < new Date()) {
    await service.from("offers").update({ status: "expired" }).eq("id", offer.id);
    return { error: "This offer link has expired" };
  }

  const batch = await currentStorefrontBatch(service, offer.product_id);
  if (!batch) return { error: "This item is no longer available" };
  if (offer.qty > batch.available) return { error: "Not enough stock left for this offer" };

  const { data: product } = await service
    .from("products")
    .select("id, name, image_url")
    .eq("id", offer.product_id)
    .maybeSingle();
  if (!product) return { error: "This product is no longer available" };

  const lines = Array.from({ length: offer.qty }, () => ({
    product_id: offer.product_id,
    inventory_batch_id: batch.id,
    price: offer.offered_price,
  }));

  const customerId = await getCurrentCustomerId();

  const { result, internalOrderId } = await chargeAndCreateOrder({
    service,
    lines,
    grossAmount: offer.offered_price * offer.qty,
    customer: { name, phone, address, email },
    paymentMethod,
    bankCode,
    customerId,
    buildEmailLines: async () => [
      {
        name: product.name,
        qty: offer.qty,
        price: offer.offered_price,
        imageUrl: product.image_url,
      },
    ],
  });

  if (internalOrderId) {
    await service.from("offers").update({ status: "completed", order_id: internalOrderId }).eq("id", offer.id);
  }

  return result;
}
