"use client";

import { useState, useTransition } from "react";
import { quoteCardRequest, rejectCardRequest } from "@/app/actions/adminCardRequests";
import ButtonSpinner from "@/app/ButtonSpinner";

export default function RequestActions({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition();
  const [isQuoting, setIsQuoting] = useState(false);
  const [price, setPrice] = useState("");
  const [snkrdunkUrl, setSnkrdunkUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submitQuote = () => {
    setError(null);
    const value = Number(price);
    if (!value || value <= 0) {
      setError("Enter a valid price");
      return;
    }
    startTransition(() => {
      quoteCardRequest(requestId, value, snkrdunkUrl).then((res) => {
        if (res.error) setError(res.error);
      });
    });
  };

  const submitReject = () => {
    setError(null);
    startTransition(() => {
      rejectCardRequest(requestId).then((res) => {
        if (res.error) setError(res.error);
      });
    });
  };

  if (!isQuoting) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => setIsQuoting(true)}
            className="rounded bg-black px-3 py-1.5 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Quote price
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={submitReject}
            className="relative rounded border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            <span className={isPending ? "invisible" : ""}>Reject</span>
            {isPending && <ButtonSpinner className="h-3 w-3" />}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex w-48 flex-col items-end gap-1">
      <input
        type="number"
        min="1"
        step="1"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Quoted price (IDR)"
        className="w-full rounded border px-2 py-1 text-right text-xs"
      />
      <input
        type="url"
        value={snkrdunkUrl}
        onChange={(e) => setSnkrdunkUrl(e.target.value)}
        placeholder="SNKRDUNK link (optional)"
        className="w-full rounded border px-2 py-1 text-right text-xs"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={submitQuote}
          className="relative rounded bg-black px-3 py-1.5 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <span className={isPending ? "invisible" : ""}>Send quote</span>
          {isPending && <ButtonSpinner className="h-3 w-3" />}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setIsQuoting(false)}
          className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
