"use server";

import { headers } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { chargeMidtrans, type MidtransChargeRequest } from "@/lib/midtrans";
import { getCurrentCustomerId } from "@/lib/customerAuth";

const DEFAULT_DIRECT_PRICE_PCT = 1.15;

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type CheckoutItem = { productId: string; qty: number };

export type CheckoutPaymentMethod = "bank_transfer" | "qris" | "gopay" | "shopeepay" | "cstore";
export type CheckoutBank = "bca" | "bni" | "bri" | "permata";

export type CheckoutResult =
  | { error: string }
  | {
      orderId: string;
      paymentMethod: CheckoutPaymentMethod;
      bank?: string;
      vaNumber?: string;
      qrUrl?: string;
      qrExpiry?: string;
      deeplinkUrl?: string;
      paymentCode?: string;
      store?: string;
    };

export async function createOrderAndCharge(
  items: CheckoutItem[],
  customer: { name: string; phone: string; address: string },
  paymentMethod: CheckoutPaymentMethod,
  bankCode: CheckoutBank = "bca"
): Promise<CheckoutResult> {
  const name = customer.name.trim();
  const phone = customer.phone.trim();
  const address = customer.address.trim();
  if (!name || !phone || !address) return { error: "Name, phone, and address are required" };
  if (items.length === 0) return { error: "Your cart is empty" };

  const service = serviceClient();

  // Re-derive everything server-side from the storefront-priced batches —
  // never trust price/availability the client sent.
  const { data: batches, error: batchesError } = await service
    .from("inventory_batch_availability")
    .select("id, product_id, cost, direct_price, available")
    .eq("is_storefront_price", true)
    .in(
      "product_id",
      items.map((i) => i.productId)
    );
  if (batchesError) return { error: batchesError.message };

  const batchByProduct = new Map((batches ?? []).map((b) => [b.product_id, b]));

  const lines: { product_id: string; inventory_batch_id: string; price: number }[] = [];
  let grossAmount = 0;
  for (const item of items) {
    const batch = batchByProduct.get(item.productId);
    if (!batch) return { error: "One of the items in your cart is no longer available" };
    if (item.qty > batch.available) {
      return { error: "Not enough stock left for one of the items in your cart" };
    }
    const price = batch.direct_price ?? batch.cost * DEFAULT_DIRECT_PRICE_PCT;
    grossAmount += price * item.qty;
    for (let i = 0; i < item.qty; i++) {
      lines.push({ product_id: item.productId, inventory_batch_id: batch.id, price });
    }
  }

  const customerId = await getCurrentCustomerId();

  const orderCode = `ZLAP-${Date.now()}`;
  const { data: order, error: orderError } = await service
    .from("orders")
    .insert({
      order_id: orderCode,
      channel: "website",
      date: new Date().toISOString(),
      customer_name: name,
      customer_phone: phone,
      customer_address: address,
      payment_method: paymentMethod,
      customer_id: customerId,
    })
    .select("id")
    .single();
  if (orderError) return { error: orderError.message };

  const { error: linesError } = await service
    .from("order_lines")
    .insert(lines.map((l) => ({ ...l, order_id: order.id })));
  if (linesError) {
    await service.from("orders").delete().eq("id", order.id);
    return { error: linesError.message };
  }

  try {
    let extra: Partial<MidtransChargeRequest> = {};
    if (paymentMethod === "bank_transfer") {
      extra = { bank_transfer: { bank: bankCode } };
    } else if (paymentMethod === "gopay") {
      extra = { gopay: { enable_callback: false } };
    } else if (paymentMethod === "shopeepay") {
      const headersList = await headers();
      const host = headersList.get("host") ?? "localhost:3000";
      const protocol = host.startsWith("localhost") ? "http" : "https";
      extra = { shopeepay: { callback_url: `${protocol}://${host}/store/account` } };
    } else if (paymentMethod === "cstore") {
      extra = { cstore: { store: "indomaret", message: `Zlap order ${orderCode}` } };
    }

    const charge = await chargeMidtrans({
      payment_type: paymentMethod,
      transaction_details: { order_id: orderCode, gross_amount: Math.round(grossAmount) },
      ...extra,
      customer_details: { first_name: name, phone },
    });

    // Permata VA doesn't come back through va_numbers like the other banks.
    const vaNumber = charge.va_numbers?.[0]?.va_number ?? charge.permata_va_number;
    const bank = charge.va_numbers?.[0]?.bank ?? (charge.permata_va_number ? "permata" : undefined);
    const qrUrl = charge.actions?.find((a) => a.name === "generate-qr-code")?.url;
    const deeplinkUrl = charge.actions?.find((a) => a.name === "deeplink-redirect")?.url;
    const paymentCode = charge.payment_code;
    const store = charge.store;
    // Midtrans returns expiry_time as "YYYY-MM-DD HH:mm:ss" in the merchant's
    // local time (WIB / UTC+7), not UTC — convert to a real ISO timestamp so
    // the order page can compare it against the customer's clock correctly.
    const qrExpiry = charge.expiry_time
      ? new Date(`${charge.expiry_time.replace(" ", "T")}+07:00`).toISOString()
      : undefined;

    await service
      .from("orders")
      .update({
        payment_status: "pending",
        payment_details: {
          transaction_id: charge.transaction_id,
          va_number: vaNumber,
          bank,
          qr_url: qrUrl,
          qr_expiry: qrExpiry,
          deeplink_url: deeplinkUrl,
          payment_code: paymentCode,
          store,
        },
      })
      .eq("id", order.id);

    return { orderId: orderCode, paymentMethod, bank, vaNumber, qrUrl, qrExpiry, deeplinkUrl, paymentCode, store };
  } catch (err) {
    // Payment couldn't be started — release the reserved stock rather than
    // leaving a dangling unpaid order behind.
    await service.from("order_lines").delete().eq("order_id", order.id);
    await service.from("orders").delete().eq("id", order.id);
    return { error: err instanceof Error ? err.message : "Payment could not be started" };
  }
}
