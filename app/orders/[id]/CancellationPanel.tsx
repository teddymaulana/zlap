"use client";

import { useState, useTransition } from "react";
import { approveCancellation, rejectCancellation, markRefundComplete } from "@/app/actions/orders";
import ButtonSpinner from "@/app/ButtonSpinner";
import type { Order } from "@/lib/types";

export default function CancellationPanel({ order }: { order: Order }) {
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | "refund" | null>(null);

  const run = (action: () => Promise<void>, which: "approve" | "reject" | "refund") => {
    setPendingAction(which);
    startTransition(() => action());
  };

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
            onClick={() => run(() => approveCancellation(order.id), "approve")}
            className="relative rounded bg-black px-3 py-1.5 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <span className={isPending && pendingAction === "approve" ? "invisible" : ""}>Approve</span>
            {isPending && pendingAction === "approve" && <ButtonSpinner className="h-3 w-3" />}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => rejectCancellation(order.id), "reject")}
            className="relative rounded border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            <span className={isPending && pendingAction === "reject" ? "invisible" : ""}>Reject</span>
            {isPending && pendingAction === "reject" && <ButtonSpinner className="h-3 w-3" />}
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
          onClick={() => run(() => markRefundComplete(order.id), "refund")}
          className="relative rounded bg-black px-3 py-1.5 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <span className={isPending && pendingAction === "refund" ? "invisible" : ""}>Mark as refunded</span>
          {isPending && pendingAction === "refund" && <ButtonSpinner className="h-3 w-3" />}
        </button>
      </div>
    );
  }

  return null;
}
