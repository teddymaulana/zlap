"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addPoDelay, markPoArrived, markPoBought, markPoShipped } from "@/app/actions/preorders";
import ButtonSpinner from "@/app/ButtonSpinner";
import { daysUntil, poEta, PO_DEFAULT_TRANSIT_DAYS, type PoDelay } from "@/lib/preorder";
import type { Purchase } from "@/lib/types";

export type PoLinkedLine = {
  id: string;
  orderInternalId: string;
  orderCode: string;
  customerName: string | null;
  productName: string;
  linkedToStock: boolean;
};

const STEPS = [
  { key: "buying", label: "Buying" },
  { key: "bought", label: "Bought in Japan" },
  { key: "shipping", label: "Shipping from Japan" },
  { key: "arrived", label: "Arrived in Indonesia" },
] as const;

function formatDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

// Staff controls for a pre-order purchase (see app/actions/preorders.ts).
// Every button emails the customers whose pre-orders are in this purchase.
export default function PurchasePreorderPanel({
  purchase,
  delays,
  lines,
}: {
  purchase: Purchase;
  delays: PoDelay[];
  lines: PoLinkedLine[];
}) {
  const [transitDays, setTransitDays] = useState(String(PO_DEFAULT_TRANSIT_DAYS));
  const [delayDays, setDelayDays] = useState("3");
  const [delayReason, setDelayReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<{ error?: string }>, onDone?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (result.error) setError(result.error);
      else onDone?.();
    });

  const stepIndex = STEPS.findIndex((s) => s.key === purchase.po_status);
  const eta = poEta({ shippedAt: purchase.po_shipped_at, transitDays: purchase.po_transit_days, delays });
  const orderCount = new Set(lines.map((l) => l.orderCode)).size;

  const actionButton = (label: string, onClick: () => void, confirmText?: string) => (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        onClick();
      }}
      className="relative rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
    >
      <span className={isPending ? "invisible" : ""}>{label}</span>
      {isPending && <ButtonSpinner />}
    </button>
  );

  return (
    <div className="mb-8 rounded border border-blue-200 bg-blue-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Pre-order progress</h2>
        <span className="text-xs text-gray-500">
          {lines.length} item{lines.length === 1 ? "" : "s"} for {orderCount} order{orderCount === 1 ? "" : "s"} · each
          step emails these customers
        </span>
      </div>

      <ol className="mb-4 grid grid-cols-4 gap-2 text-xs">
        {STEPS.map((step, i) => (
          <li
            key={step.key}
            className={`rounded px-2 py-1.5 text-center ${
              i < stepIndex
                ? "bg-black text-white"
                : i === stepIndex
                  ? "bg-black font-semibold text-white ring-2 ring-blue-300"
                  : "bg-white text-gray-400"
            }`}
          >
            {step.label}
          </li>
        ))}
      </ol>

      <div className="mb-3 text-sm text-gray-700">
        {purchase.po_bought_at && <div>Bought: {formatDate(purchase.po_bought_at)}</div>}
        {purchase.po_shipped_at && (
          <div>
            Shipped from Japan: {formatDate(purchase.po_shipped_at)} · transit {purchase.po_transit_days} days
          </div>
        )}
        {eta && purchase.po_status === "shipping" && (
          <div className="font-medium">
            Estimated arrival: {formatDate(eta)} ({daysUntil(eta)} day{daysUntil(eta) === 1 ? "" : "s"} left)
          </div>
        )}
        {purchase.po_arrived_at && <div>Arrived: {formatDate(purchase.po_arrived_at)}</div>}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {purchase.po_status === "buying" &&
          actionButton("Mark bought in Japan", () => run(() => markPoBought(purchase.id)))}

        {purchase.po_status === "bought" && (
          <>
            <label className="flex flex-col text-xs text-gray-600">
              Transit estimate (days)
              <input
                type="number"
                min={1}
                max={90}
                value={transitDays}
                onChange={(e) => setTransitDays(e.target.value)}
                className="w-28 rounded border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            {actionButton("Mark shipped from Japan", () =>
              run(() => markPoShipped(purchase.id, Number(transitDays)))
            )}
          </>
        )}

        {purchase.po_status === "shipping" && (
          <>
            {actionButton(
              "Mark arrived in Indonesia",
              () => run(() => markPoArrived(purchase.id)),
              "Mark arrived? This pushes the purchase into inventory and links the pre-order items to it."
            )}
            <div className="flex flex-wrap items-end gap-2 rounded border bg-white p-2">
              <label className="flex flex-col text-xs text-gray-600">
                Delay (days)
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={delayDays}
                  onChange={(e) => setDelayDays(e.target.value)}
                  className="w-20 rounded border px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex flex-col text-xs text-gray-600">
                Reason (customers see this)
                <input
                  type="text"
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  placeholder="e.g. Customs inspection"
                  className="w-64 rounded border px-2 py-1.5 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={isPending || !delayReason.trim()}
                onClick={() =>
                  run(
                    () => addPoDelay(purchase.id, Number(delayDays), delayReason),
                    () => setDelayReason("")
                  )
                }
                className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Add delay
              </button>
            </div>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {delays.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 text-sm font-medium">Delays</h3>
          <ul className="text-sm text-gray-700">
            {delays.map((d, i) => (
              <li key={i}>
                +{d.days} day{d.days === 1 ? "" : "s"} — {d.reason}{" "}
                <span className="text-xs text-gray-400">({formatDate(d.createdAt)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <h3 className="mb-1 text-sm font-medium">Customer orders in this purchase</h3>
        <div className="divide-y rounded border bg-white">
          {lines.map((line) => (
            <div key={line.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
              <Link href={`/zlap-adm/orders/${line.orderInternalId}`} className="font-mono text-xs underline">
                {line.orderCode}
              </Link>
              <span className="min-w-0 flex-1 truncate">{line.productName}</span>
              <span className="text-gray-500">{line.customerName || "Guest"}</span>
              {purchase.po_status === "arrived" && !line.linkedToStock && (
                <span className="text-xs text-red-600">not linked to stock — raise the purchase line qty</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
