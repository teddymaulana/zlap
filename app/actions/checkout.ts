"use server";

import { headers } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { chargeMidtrans, type MidtransChargeRequest } from "@/lib/midtrans";
import { getCurrentCustomerId } from "@/lib/customerAuth";
import { sendOrderConfirmationEmail, type OrderConfirmationLine } from "@/lib/email";
import { ALL_GIFT_TAGS, computeEarnedGifts, giftRoleForTags, isGiftProduct, type GiftRole } from "@/lib/gwp";
import { getActiveDiscounts } from "@/app/actions/discounts";
import { priceWithDiscounts, computeEarnedBogoFreebies, applyCodeToCart, findDiscountByCode } from "@/lib/discounts";
import { isGradedOrSingleProduct } from "@/lib/productCategory";

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

// Shared by every "charge Midtrans for an order that already has its rows
// inserted" path: charge Midtrans, persist payment details, email the
// confirmation. Callers resolve `lines`/`grossAmount` themselves since that
// step differs (cart batch pricing vs. a fixed offer price vs. admin-set
// prices), and `buildEmailLines` is only invoked after a successful charge,
// so a doomed charge doesn't pay for it.
//
// Does NOT roll back the order/lines on a failed charge — callers that just
// inserted an ephemeral order (see chargeAndCreateOrder below) do their own
// rollback around this call; an order that already existed before the charge
// (an ERP-built order the admin reserved stock against) is left as-is so
// staff/customer can retry rather than silently losing the reservation.
export async function chargeExistingOrder(params: {
  service: ReturnType<typeof serviceClient>;
  orderInternalId: string;
  orderCode: string;
  lines: { product_id: string; inventory_batch_id: string | null; price: number }[];
  grossAmount: number;
  customer: { name: string; phone: string; address: string; email: string };
  paymentMethod: CheckoutPaymentMethod;
  bankCode: CheckoutBank;
  buildEmailLines: () => Promise<OrderConfirmationLine[]>;
}): Promise<CheckoutResult> {
  const { service, orderInternalId, orderCode, lines, grossAmount, customer, paymentMethod, bankCode, buildEmailLines } =
    params;
  const { name, phone, email } = customer;

  try {
    // Group per-unit order lines into per-(product, price) quantities for
    // Midtrans' item_details — without this the transaction shows only the
    // total amount, with no line-item breakdown in the Midtrans dashboard.
    // Keyed by product+price (not product alone) since an ERP-built order
    // can have two lines on the same product at two different admin-set
    // prices — grouping by product alone would silently drop one price.
    const qtyAndPriceByKey = new Map<string, { productId: string; price: number; quantity: number }>();
    for (const line of lines) {
      const key = `${line.product_id}:${line.price}`;
      const existing = qtyAndPriceByKey.get(key);
      if (existing) existing.quantity += 1;
      else qtyAndPriceByKey.set(key, { productId: line.product_id, price: line.price, quantity: 1 });
    }
    const { data: productRows } = await service
      .from("products")
      .select("id, name")
      .in("id", Array.from(new Set(lines.map((l) => l.product_id))));
    const productNameById = new Map((productRows ?? []).map((p) => [p.id, p.name]));
    const itemDetails = Array.from(qtyAndPriceByKey.entries()).map(([key, v]) => ({
      id: key,
      price: Math.round(v.price),
      quantity: v.quantity,
      // Midtrans caps item name at 50 characters.
      name: (productNameById.get(v.productId) ?? "Item").slice(0, 50),
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
      extra = { shopeepay: { callback_url: `${protocol}://${host}/account` } };
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
        payment_method: paymentMethod,
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
      .eq("id", orderInternalId);

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

    return { orderId: orderCode, paymentMethod, bank, vaNumber, qrUrl, qrExpiry, deeplinkUrl, paymentCode, store };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Payment could not be started" };
  }
}

// Shared by the normal cart checkout and the offer/card-request checkouts —
// inserts a brand-new order + lines, then charges it via chargeExistingOrder.
// Rolls the insert back if the charge fails, since this order never existed
// before the checkout attempt.
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

  const result = await chargeExistingOrder({
    service,
    orderInternalId: order.id,
    orderCode,
    lines,
    grossAmount,
    customer,
    paymentMethod,
    bankCode,
    buildEmailLines,
  });

  if ("error" in result) {
    // Payment couldn't be started — release the reserved stock rather than
    // leaving a dangling unpaid order behind.
    await service.from("order_lines").delete().eq("order_id", order.id);
    await service.from("orders").delete().eq("id", order.id);
    return { result, internalOrderId: null };
  }

  return { result, internalOrderId: order.id };
}

export async function createOrderAndCharge(
  items: CheckoutItem[],
  customer: { name: string; phone: string; address: string; email: string },
  paymentMethod: CheckoutPaymentMethod,
  bankCode: CheckoutBank = "bca",
  discountCode?: string
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

  // Tags for everything the client asked for (to spot/ignore any gift-tagged
  // entries it sent) plus the canonical gift-role catalog (so an earned gift
  // resolves to a product even if the client never added it itself) — never
  // trust the client's own idea of what's a gift or how many it's owed.
  const requestedIds = [...new Set(items.map((i) => i.productId))];
  const [
    { data: requestedProducts, error: requestedError },
    { data: giftProducts, error: giftProductsError },
    discounts,
    customerId,
  ] = await Promise.all([
    service.from("products").select("id, name, image_url, tags, set_id").in("id", requestedIds),
    service.from("products").select("id, name, image_url, tags, set_id").overlaps("tags", ALL_GIFT_TAGS),
    getActiveDiscounts(),
    getCurrentCustomerId(),
  ]);
  if (requestedError) return { error: requestedError.message };
  if (giftProductsError) return { error: giftProductsError.message };

  // Re-validated from scratch here — never trust that the client's cart
  // preview correctly matched the code to an active discount or the
  // customer's login state.
  let redeemedCode: ReturnType<typeof findDiscountByCode> = null;
  if (discountCode) {
    redeemedCode = findDiscountByCode(discountCode, discounts);
    if (!redeemedCode) return { error: "Invalid or expired discount code" };
    if ((redeemedCode.requiresLogin || redeemedCode.oncePerCustomer) && !customerId) {
      return { error: "Sign in to use this discount code" };
    }
    if (redeemedCode.oncePerCustomer && customerId) {
      const { data: existingRedemption, error: redemptionCheckError } = await service
        .from("discount_redemptions")
        .select("id")
        .eq("discount_id", redeemedCode.id)
        .eq("customer_id", customerId)
        .maybeSingle();
      if (redemptionCheckError) return { error: redemptionCheckError.message };
      if (existingRedemption) return { error: "You've already used this discount code" };
    }
  }

  const productById = new Map([...(requestedProducts ?? []), ...(giftProducts ?? [])].map((p) => [p.id, p]));
  const giftProductByRole = new Map<GiftRole, { id: string }>();
  for (const p of giftProducts ?? []) {
    const role = giftRoleForTags(p.tags);
    if (role) giftProductByRole.set(role, p);
  }

  // Gift-tagged products are never directly purchasable — any qty the client
  // sent for them is dropped here; the real quantities are recomputed from
  // scratch below so a tampered request can't claim extra (or unearned) free
  // gifts.
  const regularItems = items.filter((i) => !isGiftProduct(productById.get(i.productId)?.tags));
  if (regularItems.length === 0) return { error: "Your cart is empty" };

  const earnedGifts = computeEarnedGifts(
    regularItems.map((i) => ({ tags: productById.get(i.productId)?.tags, qty: i.qty }))
  );
  const giftItems: { productId: string; qty: number }[] = (Object.keys(earnedGifts) as GiftRole[])
    .map((role) => ({ qty: earnedGifts[role], product: giftProductByRole.get(role) }))
    .filter((g): g is { qty: number; product: { id: string } } => g.qty > 0 && !!g.product)
    .map((g) => ({ productId: g.product.id, qty: g.qty }));

  // Same idea as gift-with-purchase, but the trigger/free products are
  // whatever admin picked in /zlap-adm/discounts instead of a fixed tag —
  // recomputed from scratch here for the same reason (never trust the
  // client's claimed gift qty).
  const earnedBogo = computeEarnedBogoFreebies(
    regularItems.map((i) => ({ productId: i.productId, qty: i.qty })),
    discounts
  );
  const bogoFreeProductIds = [...earnedBogo.keys()].filter((id) => !productById.has(id));
  if (bogoFreeProductIds.length > 0) {
    const { data: bogoProducts, error: bogoProductsError } = await service
      .from("products")
      .select("id, name, image_url, tags, set_id")
      .in("id", bogoFreeProductIds);
    if (bogoProductsError) return { error: bogoProductsError.message };
    for (const p of bogoProducts ?? []) productById.set(p.id, p);
  }

  // Free items earned from either system, merged into one map so a product
  // that happens to be earned by both isn't fulfilled/priced twice.
  const freeQtyByProduct = new Map<string, number>();
  for (const g of giftItems) freeQtyByProduct.set(g.productId, (freeQtyByProduct.get(g.productId) ?? 0) + g.qty);
  for (const [productId, qty] of earnedBogo) freeQtyByProduct.set(productId, (freeQtyByProduct.get(productId) ?? 0) + qty);

  // Re-derive everything server-side from the storefront-priced batches —
  // never trust price/availability the client sent.
  const { data: batches, error: batchesError } = await service
    .from("inventory_batch_availability")
    .select("id, product_id, cost, direct_price, storefront_available")
    .eq("is_storefront_price", true)
    .in(
      "product_id",
      regularItems.map((i) => i.productId)
    );
  if (batchesError) return { error: batchesError.message };

  const batchByProduct = new Map((batches ?? []).map((b) => [b.product_id, b]));
  const basePriceByProduct = new Map(
    regularItems.map((item) => {
      const batch = batchByProduct.get(item.productId);
      return [item.productId, batch ? (batch.direct_price ?? batch.cost * DEFAULT_DIRECT_PRICE_PCT) : 0];
    })
  );
  const discountedPriceByProduct = priceWithDiscounts(basePriceByProduct, discounts);
  const { priceByProduct: codePriceByProduct, cartDiscountAmount } = applyCodeToCart(
    regularItems.map((item) => ({
      productId: item.productId,
      qty: item.qty,
      basePrice: basePriceByProduct.get(item.productId) ?? 0,
      autoPrice: discountedPriceByProduct.get(item.productId)?.price ?? 0,
    })),
    redeemedCode
  );

  const lines: { product_id: string; inventory_batch_id: string; price: number }[] = [];
  const finalItems: { productId: string; qty: number; price: number }[] = [];
  let grossAmount = 0;
  for (const item of regularItems) {
    const batch = batchByProduct.get(item.productId);
    if (!batch) return { error: "One of the items in your cart is no longer available" };
    if (item.qty > batch.storefront_available) {
      return { error: "Not enough stock left for one of the items in your cart" };
    }
    const price = codePriceByProduct.get(item.productId)!;
    grossAmount += price * item.qty;
    finalItems.push({ productId: item.productId, qty: item.qty, price });
    for (let i = 0; i < item.qty; i++) {
      lines.push({ product_id: item.productId, inventory_batch_id: batch.id, price });
    }
  }
  // A whole-cart code's own cut isn't reflected in any line price — see
  // applyCodeToCart — so it comes off the total here instead.
  grossAmount = Math.max(0, grossAmount - cartDiscountAmount);

  // Free items are priced at 0 regardless of the product's own cost, and
  // fulfilled from whichever of its batches currently has the most stock —
  // these products are typically never storefront-priced, so the lookup
  // above never sees them. If stock has run out, the free item is silently
  // dropped rather than blocking the sale of what the customer is paying for.
  if (freeQtyByProduct.size > 0) {
    const { data: giftBatches, error: giftBatchesError } = await service
      .from("inventory_batch_availability")
      .select("id, product_id, available")
      .in("product_id", [...freeQtyByProduct.keys()]);
    if (giftBatchesError) return { error: giftBatchesError.message };

    const bestBatchByProduct = new Map<string, { id: string; available: number }>();
    for (const b of giftBatches ?? []) {
      const current = bestBatchByProduct.get(b.product_id);
      if (!current || b.available > current.available) {
        bestBatchByProduct.set(b.product_id, { id: b.id, available: b.available });
      }
    }

    for (const [productId, qty] of freeQtyByProduct) {
      const batch = bestBatchByProduct.get(productId);
      if (!batch || qty > batch.available) continue;
      finalItems.push({ productId, qty, price: 0 });
      for (let i = 0; i < qty; i++) {
        lines.push({ product_id: productId, inventory_batch_id: batch.id, price: 0 });
      }
    }
  }

  // Only graded/single items need their set language resolved for the
  // confirmation email (see isGradedOrSingleProduct) — batched into one
  // query rather than one lookup per line item.
  const emailLanguageSetIds = [...productById.values()]
    .filter((p): p is typeof p & { set_id: string } => Boolean(p.set_id) && isGradedOrSingleProduct(p))
    .map((p) => p.set_id);
  const { data: emailLanguageSets } =
    emailLanguageSetIds.length > 0
      ? await service.from("card_sets").select("id, language").in("id", [...new Set(emailLanguageSetIds)])
      : { data: [] };
  const emailLanguageBySetId = new Map((emailLanguageSets ?? []).map((s) => [s.id, s.language as "en" | "jp" | "id"]));

  const { result, internalOrderId } = await chargeAndCreateOrder({
    service,
    lines,
    grossAmount,
    customer: { name, phone, address, email },
    paymentMethod,
    bankCode,
    customerId,
    buildEmailLines: async () =>
      finalItems.map((i) => {
        const p = productById.get(i.productId);
        return {
          name: p?.name ?? "Item",
          qty: i.qty,
          price: i.price,
          imageUrl: p?.image_url,
          setLanguage:
            p?.set_id && isGradedOrSingleProduct(p) ? (emailLanguageBySetId.get(p.set_id) ?? null) : null,
        };
      }),
  });

  // Best-effort: the order already succeeded and was charged, so a failure
  // recording the redemption shouldn't undo it — worst case is this
  // customer could reuse the code once, same trade-off as a gift silently
  // getting dropped when its stock has run out.
  if (redeemedCode?.oncePerCustomer && customerId && internalOrderId && !("error" in result)) {
    const { error: redemptionError } = await service
      .from("discount_redemptions")
      .insert({ discount_id: redeemedCode.id, customer_id: customerId, order_id: internalOrderId });
    if (redemptionError) console.error("Failed to record discount redemption:", redemptionError.message);
  }

  return result;
}
