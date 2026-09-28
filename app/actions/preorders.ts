"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendPreorderUpdateEmail } from "@/lib/email";
import { addDays, PO_DEFAULT_TRANSIT_DAYS } from "@/lib/preorder";
import { pushToInventory } from "@/app/actions/purchases";

// Staff workflow for Japan-sourced pre-orders: paid pre-order lines wait in
// the queue (/zlap-adm/preorders) until staff buy them together in a
// purchase, then that purchase is stepped through buying -> bought ->
// shipping (+ delays) -> arrived. Every step emails the affected customers
// and shows on their order page (app/actions/customer.ts poProgress).
//
// All of this runs on the signed-in staff client — RLS only lets
// authenticated (staff) sessions touch these tables.

type Db = Awaited<ReturnType<typeof createClient>>;

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
}

// One email per affected order (not per line). Best-effort, like every
// other order email — a send failure never undoes the status change.
async function notifyCustomers(db: Db, purchaseId: string, heading: string, message: string) {
  const { data } = await db
    .from("order_lines")
    .select("orders(order_id, customer_email, status)")
    .eq("po_purchase_id", purchaseId)
    .eq("is_po", true);
  const orders = new Map<string, string>();
  for (const row of data ?? []) {
    const order = row.orders as unknown as { order_id: string; customer_email: string | null; status: string } | null;
    if (order?.customer_email && order.status !== "cancelled") orders.set(order.order_id, order.customer_email);
  }
  await Promise.all(
    [...orders].map(([orderCode, to]) => sendPreorderUpdateEmail({ to, orderCode, heading, message }))
  );
}

async function loadPurchase(db: Db, purchaseId: string) {
  const { data, error } = await db
    .from("purchases")
    .select("id, po_status, po_shipped_at, po_transit_days")
    .eq("id", purchaseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Purchase not found");
  return data;
}

function refresh(purchaseId: string) {
  revalidatePath(`/zlap-adm/purchases/${purchaseId}`);
  revalidatePath("/zlap-adm/preorders");
  revalidatePath("/zlap-adm/orders");
}

// Buys the selected queued lines together: a new purchase (status
// "buying"), the lines pointed at it, and one purchase line per product so
// the normal cost / push-to-inventory flow works when it arrives. Unit cost
// starts at the market estimate the customer was priced from (before
// markup) — staff overwrite it with what they actually paid.
export async function createPoPurchase(orderLineIds: string[]): Promise<{ purchaseId: string } | { error: string }> {
  if (orderLineIds.length === 0) return { error: "Select at least one pre-order item" };
  const db = await createClient();

  const { data: lines, error } = await db
    .from("order_lines")
    .select("id, product_id, is_po, po_purchase_id, products(po_base_jpy, po_fx_rate)")
    .in("id", orderLineIds);
  if (error) throw new Error(error.message);
  const queued = (lines ?? []).filter((l) => l.is_po && !l.po_purchase_id);
  if (queued.length === 0) return { error: "Those items are already in a purchase" };

  const today = new Date().toISOString().slice(0, 10);
  const { data: purchase, error: purchaseError } = await db
    .from("purchases")
    .insert({ name: `Pre-order ${today}`, date: today, po_status: "buying" })
    .select("id")
    .single();
  if (purchaseError) throw new Error(purchaseError.message);

  const { error: assignError } = await db
    .from("order_lines")
    .update({ po_purchase_id: purchase.id })
    .in(
      "id",
      queued.map((l) => l.id)
    );
  if (assignError) throw new Error(assignError.message);

  const byProduct = new Map<string, { qty: number; unitCost: number }>();
  for (const line of queued) {
    const product = line.products as unknown as { po_base_jpy: number | null; po_fx_rate: number | null } | null;
    const estimate =
      product?.po_base_jpy && product.po_fx_rate ? Math.round(product.po_base_jpy * product.po_fx_rate) : 0;
    const entry = byProduct.get(line.product_id) ?? { qty: 0, unitCost: estimate };
    entry.qty += 1;
    byProduct.set(line.product_id, entry);
  }
  const { error: linesError } = await db.from("purchase_lines").insert(
    [...byProduct].map(([productId, { qty, unitCost }]) => ({
      purchase_id: purchase.id,
      product_id: productId,
      qty,
      unit_cost: unitCost,
    }))
  );
  if (linesError) throw new Error(linesError.message);

  refresh(purchase.id);
  return { purchaseId: purchase.id };
}

async function markPoBoughtImpl(purchaseId: string) {
  const db = await createClient();
  const purchase = await loadPurchase(db, purchaseId);
  if (purchase.po_status !== "buying") throw new Error("This purchase isn't waiting to be bought");

  const { error } = await db
    .from("purchases")
    .update({ po_status: "bought", po_bought_at: new Date().toISOString() })
    .eq("id", purchaseId);
  if (error) throw new Error(error.message);

  await notifyCustomers(
    db,
    purchaseId,
    "Your pre-order item is secured",
    "we've secured your pre-order item. We'll let you know as soon as it ships to us."
  );
  refresh(purchaseId);
}

async function markPoShippedImpl(purchaseId: string, transitDays: number) {
  const days = Math.round(transitDays);
  if (!Number.isFinite(days) || days < 1 || days > 90) throw new Error("Transit days must be between 1 and 90");
  const db = await createClient();
  const purchase = await loadPurchase(db, purchaseId);
  if (purchase.po_status !== "bought") throw new Error("Mark it bought before shipping");

  const shippedAt = new Date().toISOString();
  const { error } = await db
    .from("purchases")
    .update({ po_status: "shipping", po_shipped_at: shippedAt, po_transit_days: days })
    .eq("id", purchaseId);
  if (error) throw new Error(error.message);

  await notifyCustomers(
    db,
    purchaseId,
    "Your pre-order is on its way from our supplier",
    `your pre-order item has shipped from our supplier. Estimated arrival with us: ${formatDate(addDays(shippedAt, days))}.`
  );
  refresh(purchaseId);
}

async function addPoDelayImpl(purchaseId: string, days: number, reason: string) {
  const extraDays = Math.round(days);
  const trimmedReason = reason.trim();
  if (!Number.isFinite(extraDays) || extraDays < 1 || extraDays > 60) {
    throw new Error("Delay must be between 1 and 60 days");
  }
  if (!trimmedReason) throw new Error("Add a reason for the delay — customers will see it");
  const db = await createClient();
  const purchase = await loadPurchase(db, purchaseId);
  if (purchase.po_status !== "shipping") throw new Error("Delays can only be added while it's shipping");

  const { error } = await db
    .from("purchase_po_delays")
    .insert({ purchase_id: purchaseId, days: extraDays, reason: trimmedReason });
  if (error) throw new Error(error.message);

  const { data: delays } = await db.from("purchase_po_delays").select("days").eq("purchase_id", purchaseId);
  const totalDelay = (delays ?? []).reduce((sum, d) => sum + d.days, 0);
  const eta = addDays(purchase.po_shipped_at!, (purchase.po_transit_days ?? PO_DEFAULT_TRANSIT_DAYS) + totalDelay);

  await notifyCustomers(
    db,
    purchaseId,
    "Update on your pre-order delivery",
    `your pre-order is delayed by ${extraDays} day${extraDays === 1 ? "" : "s"} (${trimmedReason}). New estimated arrival with us: ${formatDate(eta)}.`
  );
  refresh(purchaseId);
}

// Arrived in Indonesia: pushes the purchase into inventory (the normal
// purchase flow) and links each pre-order line to the batch it created, so
// those units count as sold against real stock from here on.
async function markPoArrivedImpl(purchaseId: string) {
  const db = await createClient();
  const purchase = await loadPurchase(db, purchaseId);
  if (purchase.po_status !== "shipping") throw new Error("Mark it shipped before it can arrive");

  await pushToInventory(purchaseId);
  await linkPoLinesToBatches(db, purchaseId);

  const { error } = await db
    .from("purchases")
    .update({ po_status: "arrived", po_arrived_at: new Date().toISOString() })
    .eq("id", purchaseId);
  if (error) throw new Error(error.message);

  await notifyCustomers(
    db,
    purchaseId,
    "Your pre-order has arrived with us",
    "your pre-order item has arrived with us. We're packing it now and will email you the tracking number once it ships."
  );
  refresh(purchaseId);
}

// Fills inventory_batch_id on this purchase's pre-order lines, per product,
// up to what the pushed batch has available — the stock trigger rejects
// anything beyond that, so a short purchase line (staff lowered its qty)
// leaves the remainder unlinked instead of failing the whole step.
async function linkPoLinesToBatches(db: Db, purchaseId: string) {
  const [{ data: poLines, error: poError }, { data: purchaseLines, error: plError }] = await Promise.all([
    db
      .from("order_lines")
      .select("id, product_id")
      .eq("po_purchase_id", purchaseId)
      .eq("is_po", true)
      .is("inventory_batch_id", null),
    db.from("purchase_lines").select("product_id, inventory_batch_id").eq("purchase_id", purchaseId),
  ]);
  if (poError) throw new Error(poError.message);
  if (plError) throw new Error(plError.message);

  const batchIds = (purchaseLines ?? []).map((l) => l.inventory_batch_id).filter(Boolean) as string[];
  const { data: batches, error: batchError } = await db
    .from("inventory_batch_availability")
    .select("id, product_id, available")
    .in("id", batchIds);
  if (batchError) throw new Error(batchError.message);

  for (const batch of batches ?? []) {
    const lineIds = (poLines ?? [])
      .filter((l) => l.product_id === batch.product_id)
      .slice(0, Math.max(0, batch.available))
      .map((l) => l.id);
    if (lineIds.length === 0) continue;
    const { error } = await db.from("order_lines").update({ inventory_batch_id: batch.id }).in("id", lineIds);
    if (error) throw new Error(error.message);
  }
}

// The status steps throw on bad input or a wrong step; production hides a
// thrown server-action message, so the public wrappers hand it back instead
// for the purchase page to show.
async function asResult(step: () => Promise<void>): Promise<{ error?: string }> {
  try {
    await step();
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong" };
  }
}

export async function markPoBought(purchaseId: string) {
  return asResult(() => markPoBoughtImpl(purchaseId));
}

export async function markPoShipped(purchaseId: string, transitDays: number) {
  return asResult(() => markPoShippedImpl(purchaseId, transitDays));
}

export async function addPoDelay(purchaseId: string, days: number, reason: string) {
  return asResult(() => addPoDelayImpl(purchaseId, days, reason));
}

export async function markPoArrived(purchaseId: string) {
  return asResult(() => markPoArrivedImpl(purchaseId));
}
