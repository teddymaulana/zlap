"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trackShipment, type TrackLookup } from "@/app/actions/tracking";
import { getRecommendedProducts, type StorefrontProduct } from "@/app/actions/storefront";
import ButtonSpinner from "@/app/ButtonSpinner";
import ProductCard from "../ProductCard";
import PreorderProgress from "../PreorderProgress";
import { courierName } from "@/lib/couriers";

// Courier timestamps arrive as ISO strings ("2026-09-27T17:12:25+07:00") —
// shown as "27 Sep 2026, 17.12 WIB", pinned to Jakarta time so the customer's
// own device timezone can't shift it. Anything unparseable is shown as-is.
// Exactly midnight means a date-only value (orders entered in the ERP with
// just a date), so the made-up "00.00" is left off.
function formatTrackingDate(iso: string) {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return iso;
  const day = date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const time = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
  return time === "00.00" ? day : `${day}, ${time} WIB`;
}

function initialQuery() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("awb") ?? "";
}

// Biteship's shipment statuses (https://biteship.com/id/docs/api/trackings)
// in customer words, with {courier} filled in from the order's courier.
// Unknown ones fall back to "On the way".
const COURIER_STATUS: Record<string, { title: string; detail: string }> = {
  confirmed: { title: "Shipment created", detail: "{courier} has your package details and will pick it up soon." },
  allocated: { title: "Courier assigned", detail: "A {courier} courier is scheduled to pick up your package." },
  picking_up: { title: "Being picked up", detail: "A {courier} courier is on the way to collect your package." },
  picked: { title: "In transit", detail: "Your package is with {courier} and on its way to you." },
  dropping_off: { title: "Out for delivery", detail: "Your package is out for delivery — it should arrive soon." },
  delivered: { title: "Delivered", detail: "Your package has been delivered. Enjoy your cards!" },
  on_hold: { title: "On hold", detail: "{courier} has paused this shipment. Chat with us if it stays like this." },
  return_in_transit: { title: "Returning to us", detail: "The package is on its way back to us. Please chat with us." },
  returned: { title: "Returned to us", detail: "The package came back to us. Please chat with us to resend it." },
  rejected: { title: "Delivery rejected", detail: "The delivery was rejected. Please chat with us." },
  cancelled: { title: "Shipment cancelled", detail: "{courier} cancelled this shipment. Please chat with us." },
};

type Stage = "placed" | "paid" | "shipped" | "delivered";
const STAGES: { key: Stage; label: string }[] = [
  { key: "placed", label: "Placed" },
  { key: "paid", label: "Paid" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

type TimelineEntry = { title: string; date?: string };

// Turns a lookup into what the page shows: the headline, how far along the
// 4-step bar is, and one newest-first timeline mixing the courier's events
// with our own order steps. Each stage also counts as done whenever a later
// one is (e.g. an order with a resi was clearly paid, even if it was paid
// outside the payment gateway and its payment_status never moved).
function describe(lookup: TrackLookup) {
  const { order, shipment } = lookup;
  const courier = courierName(lookup.courier);
  const withCourier = (text: string) => text.replaceAll("{courier}", courier);
  const cancelled = order?.status === "cancelled";
  const delivered = shipment?.status === "delivered";
  const shipped = delivered || Boolean(lookup.awb);
  const paid =
    shipped ||
    (order !== null &&
      (order.channel !== "website" || ["paid", "refund_pending", "refunded"].includes(order.paymentStatus)));
  const reached: Stage = delivered ? "delivered" : shipped ? "shipped" : paid ? "paid" : "placed";

  let headline: { title: string; detail: string };
  if (cancelled) {
    headline = { title: "Order cancelled", detail: "This order was cancelled. Chat with us if that's unexpected." };
  } else if (shipment) {
    const known = COURIER_STATUS[shipment.status] ?? {
      title: "On the way",
      detail: "Your package is with {courier} and on its way to you.",
    };
    headline = { title: known.title, detail: withCourier(known.detail) };
  } else if (shipped) {
    headline = {
      title: "Shipped",
      detail: lookup.shipmentError ?? `Your package has been handed to ${courier}.`,
    };
  } else if (paid && order?.poProgress && !order.hasStockItems) {
    headline = {
      title: "Pre-order in progress",
      detail: "We're sourcing your item from Japan — follow each step below.",
    };
  } else if (paid) {
    headline = {
      title: "Being packed",
      detail: "We're packing your order. You'll get the resi number by email once it ships.",
    };
  } else if (order?.paymentStatus === "expired" || order?.paymentStatus === "failed") {
    headline = {
      title: "Payment not completed",
      detail: "The payment for this order expired. Chat with us if you'd still like these items.",
    };
  } else {
    headline = { title: "Waiting for payment", detail: "We'll start packing as soon as your payment is confirmed." };
  }

  const timeline: TimelineEntry[] = [];
  if (cancelled) timeline.push({ title: "Order cancelled" });
  for (const ev of [...(shipment?.events ?? [])].reverse()) {
    timeline.push({ title: ev.description, date: ev.date });
  }
  if (shipped) timeline.push({ title: `Packed and handed to ${courier}${lookup.awb ? ` (${lookup.awb})` : ""}` });
  if (order) {
    if (paid) timeline.push({ title: "Payment confirmed" });
    timeline.push({ title: "Order placed", date: order.placedAt ?? undefined });
  }

  return { headline, reached, cancelled, timeline };
}

function ProgressBar({ reached }: { reached: Stage }) {
  const reachedIndex = STAGES.findIndex((s) => s.key === reached);
  return (
    <ol className="grid grid-cols-4">
      {STAGES.map((stage, i) => {
        const done = i <= reachedIndex;
        return (
          <li key={stage.key} className="relative flex flex-col items-center gap-1.5">
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute top-2.5 right-1/2 h-0.5 w-full -translate-y-1/2 ${
                  done ? "bg-black" : "bg-gray-200"
                }`}
              />
            )}
            <span
              className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full ${
                done ? "bg-black text-white" : "border-2 border-gray-200 bg-white"
              }`}
            >
              {done && (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </span>
            <span className={`text-xs ${done ? "font-medium text-gray-900" : "text-gray-400"}`}>{stage.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="text-xs font-medium text-gray-500 underline hover:text-black"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function TrackingResultCard({ lookup }: { lookup: TrackLookup }) {
  const { headline, reached, cancelled, timeline } = describe(lookup);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {lookup.order && <div className="mb-1 text-xs text-gray-500">Order {lookup.order.orderId}</div>}
            <h2 className={`text-xl font-semibold ${cancelled ? "text-red-600" : "text-gray-900"}`}>
              {headline.title}
            </h2>
            <p className="mt-1 max-w-md text-sm text-gray-600">{headline.detail}</p>
          </div>
          {lookup.awb && (
            <div className="rounded-md bg-gray-50 px-3 py-2 sm:text-right">
              <div className="text-[11px] tracking-wide text-gray-500 uppercase">
                {courierName(lookup.courier)} resi
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <span className="font-mono text-sm font-medium text-gray-900">{lookup.awb}</span>
                <CopyButton text={lookup.awb} />
              </div>
            </div>
          )}
        </div>
        {!cancelled && <ProgressBar reached={reached} />}
      </div>

      <ol className="p-5">
        {timeline.map((entry, i) => {
          const latest = i === 0;
          const last = i === timeline.length - 1;
          return (
            <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
              {!last && <span aria-hidden className="absolute top-3 left-[5px] h-full w-px bg-gray-200" />}
              <span
                aria-hidden
                className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ${
                  latest ? (cancelled ? "bg-red-600" : "bg-black") : "border-2 border-gray-300 bg-white"
                }`}
              />
              <div className="min-w-0">
                <div className={`text-sm ${latest ? "font-medium text-gray-900" : "text-gray-600"}`}>
                  {entry.title}
                </div>
                {entry.date && <div className="text-xs text-gray-400">{formatTrackingDate(entry.date)}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function TrackPage() {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<TrackLookup | { error: string } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  // The input `result` belongs to — pressing Track again on the same number
  // just keeps showing it instead of re-asking the server (Biteship bills
  // per lookup; the server caches too, this just skips the round trip).
  const [resultFor, setResultFor] = useState<string | null>(null);
  const [recommended, setRecommended] = useState<StorefrontProduct[]>([]);

  const search = async (raw: string) => {
    const trimmed = raw.trim();
    window.history.replaceState(null, "", trimmed ? `/track?awb=${encodeURIComponent(trimmed)}` : "/track");
    if (!trimmed) {
      setResult(null);
      setResultFor(null);
      return;
    }
    const key = trimmed.toUpperCase();
    if (isSearching || (result && resultFor === key)) return;
    setIsSearching(true);
    try {
      setResult(await trackShipment(trimmed));
      setResultFor(key);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    getRecommendedProducts().then(setRecommended);
    // Arriving from an order's "Track" link (/track?awb=…) — look it up
    // straight away rather than making the customer press Track.
    const initial = initialQuery();
    if (initial) {
      Promise.resolve().then(() => search(initial));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-1 text-2xl font-semibold">Track your order</h1>
        <p className="mb-5 text-sm text-gray-500">
          Enter your order ID (e.g. ZLAP-1234) or courier resi number. Need payment details or your item list?{" "}
          <Link href="/orders/lookup" className="text-black underline">
            Check your order
          </Link>
          .
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            search(query);
          }}
          className="mb-6 flex gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Order ID or AWB / resi number"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-4 py-3 text-base focus:border-black focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="relative rounded-md bg-black px-6 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            <span className={isSearching ? "invisible" : ""}>Track</span>
            {isSearching && <ButtonSpinner />}
          </button>
        </form>

        {isSearching ? (
          <div className="animate-pulse rounded-lg border border-gray-200 p-5" aria-label="Checking status…">
            <div className="mb-2 h-3 w-24 rounded bg-gray-100" />
            <div className="mb-2 h-6 w-40 rounded bg-gray-100" />
            <div className="mb-6 h-3 w-64 rounded bg-gray-100" />
            <div className="h-5 w-full rounded bg-gray-100" />
          </div>
        ) : result && "error" in result ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-600">
            {result.error}
          </div>
        ) : result ? (
          <>
            <TrackingResultCard lookup={result} />
            {result.order?.poProgress &&
              result.order.paymentStatus === "paid" &&
              result.order.status !== "cancelled" && (
                <div className="mt-4">
                  <PreorderProgress progress={result.order.poProgress} />
                </div>
              )}
          </>
        ) : null}

        <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600">
          Masih ada pertanyaan seputar pesanan Anda?{" "}
          <a
            href={`https://wa.me/6285121369155?text=${encodeURIComponent(
              "Halo, saya ingin bertanya tentang status pesanan saya."
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-black underline"
          >
            Hubungi kami via WhatsApp
          </a>{" "}
          dan kami akan bantu Anda.
        </div>
      </div>

      {recommended.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">You might also like</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {recommended.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
