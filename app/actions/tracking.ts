"use server";

import { unstable_cache } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { courierName, DEFAULT_COURIER, type Courier } from "@/lib/couriers";
import type { PoProgress } from "@/lib/preorder";
import { loadPoProgress } from "@/lib/preorderProgress";

export type TrackingEvent = {
  date: string;
  description: string;
};

export type TrackingResult = {
  awb: string;
  status: string;
  events: TrackingEvent[];
};

// Biteship's public waybill tracking — no Biteship order needs to exist for
// this, it just proxies the courier's own tracking. The courier code is the
// order's `courier` (lib/couriers.ts keys are Biteship's courier_codes).
// Auth header is the raw API key, no "Bearer" prefix.

// Biteship bills every tracking request, so each AWB's result is cached
// server-side (shared across visitors, refreshes, and server instances) and
// reused for this long before Biteship is asked again. Courier updates land
// hours apart, so a few minutes' staleness costs the customer nothing.
const TRACKING_CACHE_SECONDS = 10 * 60;

// Biteship error codes starting 40003 are about the waybill itself (not
// found / invalid / expired) — a stable answer worth caching so repeated
// lookups of a bad number don't keep costing money. Anything else (bad API
// key, outage) is thrown instead, which keeps it out of the cache so it
// recovers as soon as the problem is fixed.
const WAYBILL_ERROR_CODE_PREFIX = "40003";

type BiteshipTrackingResponse = {
  success: boolean;
  error?: string;
  code?: number;
  status?: string;
  history?: { note?: string; status?: string; updated_at?: string }[];
};

const fetchTracking = unstable_cache(
  async (awb: string, courier: Courier): Promise<TrackingResult | { error: string }> => {
    const res = await fetch(
      `https://api.biteship.com/v1/trackings/${encodeURIComponent(awb)}/couriers/${courier}`,
      { headers: { Authorization: process.env.BITESHIP_API_KEY! }, cache: "no-store" }
    );
    const data = (await res.json().catch(() => null)) as BiteshipTrackingResponse | null;

    if (data?.success) {
      return {
        awb,
        status: data.status ?? "Unknown",
        events: (data.history ?? []).map((h) => ({
          date: h.updated_at ?? "",
          description: h.note ?? h.status ?? "",
        })),
      };
    }
    if (data && String(data.code ?? "").startsWith(WAYBILL_ERROR_CODE_PREFIX)) {
      return {
        error: `We couldn't find tracking for that number yet. New ${courierName(courier)} shipments can take a few hours to appear.`,
      };
    }
    throw new Error(`Biteship tracking failed: HTTP ${res.status} ${data?.code ?? ""} ${data?.error ?? ""}`);
  },
  ["biteship-tracking"],
  { revalidate: TRACKING_CACHE_SECONDS }
);

// Just enough of one of our orders to draw its progress on the Track page —
// deliberately no customer details, since anyone who knows (or guesses) an
// order ID or resi number can look it up.
export type OrderTrace = {
  orderId: string;
  placedAt: string | null;
  status: string;
  paymentStatus: string;
  channel: string | null;
  // Whether the order has in-stock items, and its pre-order progress (null
  // when it has no pre-order items) — see lib/preorderProgress.ts.
  hasStockItems: boolean;
  poProgress: PoProgress | null;
};

export type TrackLookup = {
  order: OrderTrace | null;
  awb: string | null;
  courier: Courier;
  shipment: TrackingResult | null;
  // Why `shipment` is missing although there is an AWB (not found yet,
  // tracking temporarily down) — the order's own progress still shows.
  shipmentError: string | null;
};

// The Track page accepts either an order ID or an AWB, and finds our order
// either way so its own progress (placed/paid/packed) shows alongside the
// courier's. Order IDs are matched with or without a leading "#" (some
// ERP-built ones carry it) — but "ZLAP-1013" and "#ZLAP-1013" can be two
// different orders, so an exact match on what the customer typed wins over
// the #-toggled variant.
async function findOrder(
  input: string
): Promise<{ trace: OrderTrace; awb: string | null; courier: Courier } | null> {
  const typed = input.toUpperCase();
  const bare = typed.replace(/^#/, "");
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const columns = "id, order_id, date, status, payment_status, channel, awb, courier, po_awb, po_courier";

  const { data: byId } = await service.from("orders").select(columns).in("order_id", [bare, `#${bare}`]);
  let row = byId?.find((o) => o.order_id === typed) ?? byId?.[0];
  if (!row) {
    // Two plain lookups rather than one .or() — the input is customer-typed
    // and an .or() filter string would let it inject extra conditions.
    const [{ data: byAwb }, { data: byPoAwb }] = await Promise.all([
      service.from("orders").select(columns).eq("awb", typed).limit(1),
      service.from("orders").select(columns).eq("po_awb", typed).limit(1),
    ]);
    row = byAwb?.[0] ?? byPoAwb?.[0];
  }
  if (!row) return null;

  // Which of the order's two shipments to follow: the pre-order one if
  // that's the resi typed in, or if it's the only one shipped so far (an
  // order of only pre-order items has no in-stock awb at all).
  const followPreorder = row.po_awb === typed || (!row.awb && Boolean(row.po_awb));

  const { data: lines } = await service.from("order_lines").select("is_po, po_purchase_id").eq("order_id", row.id);
  const poLines = (lines ?? []).filter((l) => l.is_po);
  const poProgress =
    poLines.length > 0 ? await loadPoProgress(service, row, poLines.map((l) => l.po_purchase_id)) : null;

  return {
    trace: {
      orderId: row.order_id,
      placedAt: row.date,
      status: row.status,
      paymentStatus: row.payment_status,
      channel: row.channel,
      hasStockItems: (lines ?? []).length === 0 || (lines ?? []).some((l) => !l.is_po),
      poProgress,
    },
    awb: followPreorder ? row.po_awb : row.awb,
    courier: followPreorder ? row.po_courier : row.courier,
  };
}

export async function trackShipment(input: string): Promise<TrackLookup | { error: string }> {
  const trimmed = input.trim();
  if (!trimmed) return { error: "Enter your order ID or AWB/resi number" };

  const found = await findOrder(trimmed);
  // An input that isn't one of our orders is taken to be an AWB itself.
  const awb = found ? (found.awb?.trim().toUpperCase() ?? null) : trimmed.toUpperCase();
  // A bare resi that matches none of our orders is assumed to be J&T, the
  // courier nearly everything ships with — its own order would say otherwise.
  const courier = found?.courier ?? DEFAULT_COURIER;

  let shipment: TrackingResult | null = null;
  let shipmentError: string | null = null;
  if (awb) {
    if (!process.env.BITESHIP_API_KEY) {
      shipmentError = "Tracking isn't connected yet — check back soon";
    } else {
      try {
        const tracked = await fetchTracking(awb, courier);
        if ("error" in tracked) shipmentError = tracked.error;
        else shipment = tracked;
      } catch (err) {
        console.error("[tracking]", err);
        shipmentError = "Tracking is temporarily unavailable — please try again in a few minutes.";
      }
    }
  }

  // Neither one of our orders nor a resi the courier knows — nothing to show.
  if (!found && !shipment) return { error: shipmentError ?? "We couldn't find that order or resi number." };

  return { order: found?.trace ?? null, awb, courier, shipment, shipmentError };
}
