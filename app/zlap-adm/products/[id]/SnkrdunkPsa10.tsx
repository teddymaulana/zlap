"use client";

import { useState, useTransition } from "react";
import { getSnkrdunkPsa10, type Psa10Reference } from "@/app/actions/snkrdunk";
import ButtonSpinner from "@/app/ButtonSpinner";

function yen(amount: number) {
  return `¥${amount.toLocaleString("en-US")}`;
}

function idr(amountJpy: number, rate: number | null) {
  if (rate === null) return null;
  return `≈ IDR ${Math.round(amountJpy * rate).toLocaleString("id-ID")}`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

function Figure({ label, jpy, rate, note }: { label: string; jpy: number | null; rate: number | null; note?: string }) {
  return (
    <div className="rounded bg-gray-50 px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      {jpy === null ? (
        <div className="text-sm text-gray-400">—</div>
      ) : (
        <>
          <div className="text-sm font-semibold tabular-nums">{yen(jpy)}</div>
          {idr(jpy, rate) && <div className="text-xs text-gray-500 tabular-nums">{idr(jpy, rate)}</div>}
        </>
      )}
      {note && <div className="text-[11px] text-gray-400">{note}</div>}
    </div>
  );
}

// Staff-only PSA 10 market reference from SNKRDUNK — see
// app/actions/snkrdunk.ts. Only fetched on click; results are cached for a
// day server-side, so repeat clicks are free.
export default function SnkrdunkPsa10({ productId, hasSavedLink }: { productId: string; hasSavedLink: boolean }) {
  const [result, setResult] = useState<Psa10Reference | { error: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-2 flex flex-col gap-2 border-t pt-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!hasSavedLink || isPending}
          onClick={() => startTransition(async () => setResult(await getSnkrdunkPsa10(productId)))}
          className="relative rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <span className={isPending ? "invisible" : ""}>Fetch PSA 10 price</span>
          {isPending && <ButtonSpinner className="h-3 w-3" />}
        </button>
        {!hasSavedLink && <span className="text-xs text-gray-500">Save a SNKRDUNK link first.</span>}
      </div>

      {result && "error" in result && <p className="text-xs text-red-600">{result.error}</p>}

      {result && !("error" in result) && (
        <div className="flex flex-col gap-2">
          {result.cardName && <div className="text-xs text-gray-600">{result.cardName}</div>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Figure label="Lowest PSA 10 ask" jpy={result.lowestAskJpy} rate={result.jpyToIdr} />
            <Figure
              label={result.recentSold ? `Median of last ${result.recentSold.count} sold` : "Recent PSA 10 sales"}
              jpy={result.recentSold?.medianJpy ?? null}
              rate={result.jpyToIdr}
            />
            <Figure
              label="Recent sold range"
              jpy={result.recentSold?.minJpy ?? null}
              rate={result.jpyToIdr}
              note={result.recentSold ? `up to ${yen(result.recentSold.maxJpy)}` : undefined}
            />
          </div>
          <p className="text-[11px] text-gray-400">
            Fetched {shortDate(result.fetchedAt)} WIB · refreshes at most once a day
            {result.jpyToIdr ? ` · ¥1 ≈ IDR ${result.jpyToIdr.toFixed(1)}` : ""}. Reference only — not shown
            to customers.
          </p>
        </div>
      )}
    </div>
  );
}
