"use client";

import { useState, useTransition } from "react";
import { approveOffer, rejectOffer } from "@/app/actions/adminOffers";
import ButtonSpinner from "@/app/ButtonSpinner";

export default function OfferActions({ offerId }: { offerId: string }) {
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (action: (id: string) => Promise<{ error?: string }>, which: "approve" | "reject") => {
    setError(null);
    setPendingAction(which);
    startTransition(() => {
      action(offerId).then((res) => {
        if (res.error) setError(res.error);
      });
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(approveOffer, "approve")}
          className="relative rounded bg-black px-3 py-1.5 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <span className={isPending && pendingAction === "approve" ? "invisible" : ""}>Approve</span>
          {isPending && pendingAction === "approve" && <ButtonSpinner className="h-3 w-3" />}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(rejectOffer, "reject")}
          className="relative rounded border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
        >
          <span className={isPending && pendingAction === "reject" ? "invisible" : ""}>Reject</span>
          {isPending && pendingAction === "reject" && <ButtonSpinner className="h-3 w-3" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
