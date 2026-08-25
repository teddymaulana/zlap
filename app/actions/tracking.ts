"use server";

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
// this, it just proxies the courier's own tracking. J&T's courier_code there
// is "jnt". Auth header is the raw API key, no "Bearer" prefix.
const BITESHIP_COURIER_CODE = "jnt";

type BiteshipTrackingResponse = {
  success: boolean;
  error?: string;
  status?: string;
  history?: { note?: string; status?: string; updated_at?: string }[];
};

export async function trackShipment(awb: string): Promise<TrackingResult | { error: string }> {
  const trimmed = awb.trim();
  if (!trimmed) return { error: "Enter an AWB/resi number" };

  if (!process.env.BITESHIP_API_KEY) {
    return { error: "Tracking isn't connected yet — check back soon" };
  }

  const res = await fetch(
    `https://api.biteship.com/v1/trackings/${encodeURIComponent(trimmed)}/couriers/${BITESHIP_COURIER_CODE}`,
    { headers: { Authorization: process.env.BITESHIP_API_KEY }, cache: "no-store" }
  );
  const data = (await res.json()) as BiteshipTrackingResponse;

  if (!data.success) {
    return { error: data.error ?? "Couldn't find that AWB — check the number and try again" };
  }

  return {
    awb: trimmed,
    status: data.status ?? "Unknown",
    events: (data.history ?? []).map((h) => ({
      date: h.updated_at ?? "",
      description: h.note ?? h.status ?? "",
    })),
  };
}
