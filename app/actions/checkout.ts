"use server";

import { headers } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { chargeMidtrans, type MidtransChargeRequest } from "@/lib/midtrans";
import { getCurrentCustomerId } from "@/lib/customerAuth";
import { sendOrderConfirmationEmail, type OrderConfirmationLine } from "@/lib/email";

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

export type CheckoutSuccess = Exclude<CheckoutResult, { error: string }>;

export async function getOrderPaymentStatus(orderCode: string) {
  const service = serviceClient();
  const { data } = await service
    .from("orders")
    .select("payment_status")
    .eq("order_id", orderCode)
    .maybeSingle();
  return data?.payment_status ?? null;
}

// Reconstructs the "Complete your payment" screen after a page reload, since
// the cart (and with it the in-memory checkout result) is cleared right
// after a successful order.
export async function getOrderPaymentDetails(orderCode: string): Promise<CheckoutSuccess | null> {
  const service = serviceClient();
  const { data } = await service
    .from("orders")
    .select("payment_method, payment_details")
    .eq("order_id", orderCode)
    .maybeSingle();
  if (!data?.payment_method) return null;

  const details = (data.payment_details ?? {}) as {
    va_number?: string;
    bank?: string;
    qr_url?: string;
    qr_expiry?: string;
    deeplink_url?: string;
    payment_code?: string;
    store?: string;
  };

  return {
    orderId: orderCode,
    paymentMethod: data.payment_method as CheckoutPaymentMethod,
    bank: details.bank,
    vaNumber: details.va_number,
    qrUrl: details.qr_url,
    qrExpiry: details.qr_expiry,
    deeplinkUrl: details.deeplink_url,
    paymentCode: details.payment_code,
    store: details.store,
  };
}

// Shared by the normal cart checkout and the offer checkout (app/actions/offers.ts)
// — everything after "prices/lines are resolved" is identical: create the
// order + lines, charge Midtrans, persist payment details, email the
// confirmation, and roll back the order if the charge fails. Callers resolve
// `lines`/`grossAmount` themselves since that step differs (cart batch
// pricing vs. a fixed offer price), and `buildEmailLines` is only invoked
// after a successful charge, so a doomed charge doesn't pay for it.
export async function chargeAndCreateOrder(params: {
  service: ReturnType<typeof serviceClient>;
  lines: { product_id: string; inventory_batch_id: string | null; price: number }[];
  grossAmount: number;
  customer: { name: string; phone: string; address: string; email: string };
  paymentMethod: CheckoutPaymentMethod;
  bankCode: CheckoutBank;
  customerId: string | null;
  buildEmailLines: () => Promise<OrderConfirmationLine[]>;
}): Promise<{ result: CheckoutResult; internalOrderId: string | null }> {
  const { service, lines, grossAmount, customer, paymentMethod, bankCode, customerId, buildEmailLines } = params;
  const { name, phone, address, email } = customer;

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
      customer_email: email,
      payment_method: paymentMethod,
      customer_id: customerId,
    })
    .select("id")
    .single();
  if (orderError) return { result: { error: orderError.message }, internalOrderId: null };

  const { error: linesError } = await service
    .from("order_lines")
    .insert(lines.map((l) => ({ ...l, order_id: order.id })));
  if (linesError) {
    await service.from("orders").delete().eq("id", order.id);
    return { result: { error: linesError.message }, internalOrderId: null };
  }

  try {
    // Aggregate the per-unit order lines into per-product quantities for
    // Midtrans' item_details — without this the transaction shows only the
    // total amount, with no line-item breakdown in the Midtrans dashboard.
    const qtyAndPriceByProduct = new Map<string, { price: number; quantity: number }>();
    for (const line of lines) {
      const existing = qtyAndPriceByProduct.get(line.product_id);
      if (existing) existing.quantity += 1;
      else qtyAndPriceByProduct.set(line.product_id, { price: line.price, quantity: 1 });
    }
    const { data: productRows } = await service
      .from("products")
      .select("id, name")
      .in("id", Array.from(qtyAndPriceByProduct.keys()));
    const productNameById = new Map((productRows ?? []).map((p) => [p.id, p.name]));
    const itemDetails = Array.from(qtyAndPriceByProduct.entries()).map(([productId, v]) => ({
      id: productId,
      price: Math.round(v.price),
      quantity: v.quantity,
      // Midtrans caps item name at 50 characters.
      name: (productNameById.get(productId) ?? "Item").slice(0, 50),
    }));

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

    // gross_amount must equal the sum of item_details exactly (Midtrans
    // rejects the charge otherwise for several payment types) — derive it
    // from the rounded item prices rather than rounding the raw total.
    const itemDetailsTotal = itemDetails.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const charge = await chargeMidtrans({
      payment_type: paymentMethod,
      transaction_details: { order_id: orderCode, gross_amount: itemDetailsTotal },
      item_details: itemDetails,
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

    await sendOrderConfirmationEmail({
      to: email,
      orderCode,
      lines: await buildEmailLines(),
      total: grossAmount,
      paymentMethod,
      vaNumber,
      bank,
      paymentCode,
      store,
    });

    return {
      result: { orderId: orderCode, paymentMethod, bank, vaNumber, qrUrl, qrExpiry, deeplinkUrl, paymentCode, store },
      internalOrderId: order.id,
    };
  } catch (err) {
    // Payment couldn't be started — release the reserved stock rather than
    // leaving a dangling unpaid order behind.
    await service.from("order_lines").delete().eq("order_id", order.id);
    await service.from("orders").delete().eq("id", order.id);
    return {
      result: { error: err instanceof Error ? err.message : "Payment could not be started" },
      internalOrderId: null,
    };
  }
}

export async function createOrderAndCharge(
  items: CheckoutItem[],
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
  if (items.length === 0) return { error: "Your cart is empty" };

  const service = serviceClient();

  // Re-derive everything server-side from the storefront-priced batches —
  // never trust price/availability the client sent.
  const { data: batches, error: batchesError } = await service
    .from("inventory_batch_availability")
    .select("id, product_id, cost, direct_price, storefront_available")
    .eq("is_storefront_price", true)
    .in(
      "product_id",
      items.map((i) => i.productId)
    );
  if (batchesError) return { error: batchesError.message };

  const batchByProduct = new Map((batches ?? []).map((b) => [b.product_id, b]));

  const lines: { product_id: string; inventory_batch_id: string; price: number }[] = [];
  const priceByProduct = new Map<string, number>();
  let grossAmount = 0;
  for (const item of items) {
    const batch = batchByProduct.get(item.productId);
    if (!batch) return { error: "One of the items in your cart is no longer available" };
    if (item.qty > batch.storefront_available) {
      return { error: "Not enough stock left for one of the items in your cart" };
    }
    const price = batch.direct_price ?? batch.cost * DEFAULT_DIRECT_PRICE_PCT;
    priceByProduct.set(item.productId, price);
    grossAmount += price * item.qty;
    for (let i = 0; i < item.qty; i++) {
      lines.push({ product_id: item.productId, inventory_batch_id: batch.id, price });
    }
  }

  const customerId = await getCurrentCustomerId();

  const { result } = await chargeAndCreateOrder({
    service,
    lines,
    grossAmount,
    customer: { name, phone, address, email },
    paymentMethod,
    bankCode,
    customerId,
    buildEmailLines: async () => {
      const { data: productRows } = await service
        .from("products")
        .select("id, name, image_url")
        .in(
          "id",
          items.map((i) => i.productId)
        );
      const nameByProduct = new Map((productRows ?? []).map((p) => [p.id, p.name]));
      const imageByProduct = new Map((productRows ?? []).map((p) => [p.id, p.image_url]));
      return items.map((i) => ({
        name: nameByProduct.get(i.productId) ?? "Item",
        qty: i.qty,
        price: priceByProduct.get(i.productId) ?? 0,
        imageUrl: imageByProduct.get(i.productId),
      }));
    },
  });

  return result;
}
