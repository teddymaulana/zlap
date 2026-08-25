"use client";

import { useTransition } from "react";
import { approveCancellation, rejectCancellation, markRefundComplete } from "@/app/actions/orders";
import type { Order } from "@/lib/types";

export default function CancellationPanel({ order }: { order: Order }) {
  const [isPending, startTransition] = useTransition();

  if (order.status !== "cancelled" && order.cancellation_requested_at) {
    return (
      <div className="mb-6 rounded border border-yellow-300 bg-yellow-50 p-4 text-sm">
        <div className="mb-1 font-medium text-yellow-900">Customer requested cancellation</div>
        {order.cancellation_reason && (
          <p className="mb-2 text-yellow-800">&ldquo;{order.cancellation_reason}&rdquo;</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => approveCancellation(order.id))}
            className="rounded bg-black px-3 py-1.5 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => rejectCancellation(order.id))}
            className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    );
  }

  if (order.payment_status === "refund_pending") {
    return (
      <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-sm">
        <div className="mb-1 font-medium text-red-900">Manual refund needed</div>
        <p className="mb-2 text-red-800">
          This was paid by bank transfer — Midtrans can&apos;t refund a VA payment automatically.
          Transfer the money back to the customer manually, then confirm below.
        </p>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => markRefundComplete(order.id))}
          className="rounded bg-black px-3 py-1.5 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
        >
          Mark as refunded
        </button>
      </div>
    );
  }

  return null;
}
