"use client";

import { useState, useTransition } from "react";
import { requestOrderCancellation } from "@/app/actions/customer";
import ButtonSpinner from "@/app/ButtonSpinner";

export default function CancelOrderButton({ orderId }: { orderId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-xs text-red-600 hover:underline"
      >
        Cancel order
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded border p-2">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why do you want to cancel? (optional)"
        rows={2}
        className="rounded border px-2 py-1 text-xs"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await requestOrderCancellation(orderId, reason);
              if (res.error) {
                setError(res.error);
              } else {
                setIsOpen(false);
              }
            })
          }
          className="relative rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
        >
          <span className={isPending ? "invisible" : ""}>Confirm cancellation</span>
          {isPending && <ButtonSpinner className="h-3 w-3" />}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
        >
          Never mind
        </button>
      </div>
    </div>
  );
}
