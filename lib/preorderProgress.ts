// Server-only (not a "use server" module — callers do their own access
// checks): a customer order's pre-order progress, shared by the order pages
// (app/actions/customer.ts) and the Track page (app/actions/tracking.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PoProgress, PoStage } from "@/lib/preorder";

const PO_STAGE_ORDER: PoStage[] = ["ordered", "buying", "bought", "shipping", "arrived", "shipped_to_customer"];

// An order's pre-order items travel as one shipment, so its progress is that
// of the furthest-behind item: any item not yet in a purchase keeps the
// whole order at "ordered", otherwise it's the least-advanced purchase's
// status (and that purchase's dates and delays). Once the pre-order
// shipment has a resi, it's "shipped_to_customer".
export async function loadPoProgress(
  service: SupabaseClient,
  order: { [key: string]: unknown },
  purchaseIds: (string | null)[]
): Promise<PoProgress> {
  const base = {
    orderedAt: (order.date as string | null) ?? null,
    boughtAt: null,
    shippedAt: null,
    arrivedAt: null,
    transitDays: null,
    delays: [],
    awb: (order.po_awb as string | null) ?? null,
    courier: (order.po_courier as string | null) ?? "jnt",
  };
  if (base.awb) return { ...base, ...(await slowestPurchase(service, purchaseIds)), stage: "shipped_to_customer" };
  if (purchaseIds.some((id) => id === null)) return { ...base, stage: "ordered" };
  return { ...base, ...(await slowestPurchase(service, purchaseIds)) };
}

async function slowestPurchase(
  service: SupabaseClient,
  purchaseIds: (string | null)[]
): Promise<Omit<PoProgress, "orderedAt" | "awb" | "courier">> {
  const ids = [...new Set(purchaseIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) {
    return { stage: "ordered", boughtAt: null, shippedAt: null, arrivedAt: null, transitDays: null, delays: [] };
  }
  const { data: purchases } = await service
    .from("purchases")
    .select("id, po_status, po_bought_at, po_shipped_at, po_transit_days, po_arrived_at")
    .in("id", ids);
  const slowest = [...(purchases ?? [])].sort(
    (a, b) => PO_STAGE_ORDER.indexOf(a.po_status ?? "buying") - PO_STAGE_ORDER.indexOf(b.po_status ?? "buying")
  )[0];
  const { data: delays } = slowest
    ? await service
        .from("purchase_po_delays")
        .select("days, reason, created_at")
        .eq("purchase_id", slowest.id)
        .order("created_at", { ascending: true })
    : { data: [] };
  return {
    stage: (slowest?.po_status as PoStage | null) ?? "buying",
    boughtAt: slowest?.po_bought_at ?? null,
    shippedAt: slowest?.po_shipped_at ?? null,
    arrivedAt: slowest?.po_arrived_at ?? null,
    transitDays: slowest?.po_transit_days ?? null,
    delays: (delays ?? []).map((d) => ({ days: d.days, reason: d.reason, createdAt: d.created_at })),
  };
}
