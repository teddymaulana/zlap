"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentCustomerId } from "@/lib/customerAuth";
import {
  chargeExistingOrder,
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

// Shared by getOrderByToken and payOrderByToken — loads the order by token
// and checks it's still payable, mirroring the offer/card-request token
// gates (app/actions/offers.ts) but on payment_status instead of a
// pending/approved/rejected status column, since an ERP-built order has no
// separate "approved" state to mint the token from.
async function loadPayableOrder(service: ReturnType<typeof serviceClient>, token: string) {
  const { data: order } = await service
    .from("orders")
    .select("id, order_id, payment_status, token_expires_at, customer_name, customer_email, customer_phone")
    .eq("checkout_token", token)
    .maybeSingle();
  if (!order) return { order: null, error: null };

  if (order.payment_status === "paid") return { order: null, error: "This order has already been paid for" };
  if (order.payment_status === "pending") {
    return { order: null, error: "A payment is already in progress for this order" };
  }
  if (order.token_expires_at && new Date(order.token_expires_at) < new Date()) {
    return { order: null, error: "This checkout link has expired" };
  }

  return { order, error: null };
}

export type OrderCheckoutInfo = {
  orderCode: string;
  lines: { productId: string; productName: string; imageUrl: string | null; price: number }[];
  total: number;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
};

export async function getOrderByToken(token: string): Promise<OrderCheckoutInfo | { error: string } | null> {
  if (!token) return null;
  const service = serviceClient();

  const { order, error } = await loadPayableOrder(service, token);
  if (error) return { error };
  if (!order) return null;

  const { data: lines } = await service
    .from("order_lines")
    .select("product_id, price")
    .eq("order_id", order.id);
  if (!lines || lines.length === 0) return { error: "This order has no items" };

  const { data: products } = await service
    .from("products")
    .select("id, name, image_url")
    .in("id", [...new Set(lines.map((l) => l.product_id))]);
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  return {
    orderCode: order.order_id,
    lines: lines.map((l) => ({
      productId: l.product_id,
      productName: productById.get(l.product_id)?.name ?? "Item",
      imageUrl: productById.get(l.product_id)?.image_url ?? null,
      price: l.price ?? 0,
    })),
    total: lines.reduce((sum, l) => sum + (l.price ?? 0), 0),
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
  };
}

export async function payOrderByToken(
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

  const { order, error } = await loadPayableOrder(service, token);
  if (error) return { error };
  if (!order) return { error: "This order could not be found" };

  // Never trust client-sent pricing — re-fetch the lines the admin actually
  // priced this order at.
  const { data: lines } = await service
    .from("order_lines")
    .select("product_id, inventory_batch_id, price")
    .eq("order_id", order.id);
  if (!lines || lines.length === 0) return { error: "This order has no items" };

  const grossAmount = lines.reduce((sum, l) => sum + (l.price ?? 0), 0);

  const customerId = await getCurrentCustomerId();

  const update: Record<string, unknown> = {
    customer_name: name,
    customer_phone: phone,
    customer_address: address,
    customer_email: email,
  };
  if (customerId) {
    const { data: current } = await service.from("orders").select("customer_id").eq("id", order.id).maybeSingle();
    if (!current?.customer_id) update.customer_id = customerId;
  }
  await service.from("orders").update(update).eq("id", order.id);

  const { data: products } = await service
    .from("products")
    .select("id, name, image_url")
    .in("id", [...new Set(lines.map((l) => l.product_id))]);
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  return chargeExistingOrder({
    service,
    orderInternalId: order.id,
    orderCode: order.order_id,
    lines: lines.map((l) => ({
      product_id: l.product_id,
      inventory_batch_id: l.inventory_batch_id,
      price: l.price ?? 0,
    })),
    grossAmount,
    customer: { name, phone, address, email },
    paymentMethod,
    bankCode,
    buildEmailLines: async () =>
      lines.map((l) => ({
        name: productById.get(l.product_id)?.name ?? "Item",
        qty: 1,
        price: l.price ?? 0,
        imageUrl: productById.get(l.product_id)?.image_url,
      })),
  });
}
