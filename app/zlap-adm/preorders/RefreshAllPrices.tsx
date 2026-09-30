"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { refreshAllPoPrices } from "@/app/actions/snkrdunk";
import ButtonSpinner from "@/app/ButtonSpinner";

type Result = Awaited<ReturnType<typeof refreshAllPoPrices>>;

// Runs the every-3-days pre-order price refresh right now, for every
// pre-order product (and out-of-stock slabs showing a SNKRDUNK price).
export default function RefreshAllPrices() {
  const [result, setResult] = useState<Result | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setResult(null);
          startTransition(async () => setResult(await refreshAllPoPrices()));
        }}
        className="relative rounded border px-3 py-1.5 text-sm whitespace-nowrap hover:bg-gray-50 disabled:opacity-50"
      >
        <span className={isPending ? "invisible" : ""}>Refresh all prices</span>
        {isPending && <ButtonSpinner className="h-3 w-3" />}
      </button>
      {isPending && (
        <div className="absolute right-0 z-10 mt-1 w-64 rounded border bg-white p-2 text-xs text-gray-500 shadow">
          Updating from SNKRDUNK one product at a time — this can take a few minutes.
        </div>
      )}
      {result && (
        <div className="absolute right-0 z-10 mt-1 w-72 rounded border bg-white p-3 text-xs shadow">
          {"error" in result ? (
            <div className="text-red-600">{result.error}</div>
          ) : (
            <>
              <div className="font-medium text-gray-800">
                {result.refreshed} updated
                {result.failed.length > 0 && <span className="text-red-600"> · {result.failed.length} failed</span>}
              </div>
              {result.failed.length > 0 && (
                <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
                  {result.failed.map((f) => (
                    <li key={f.id}>
                      <Link href={`/zlap-adm/products/${f.id}`} className="font-medium underline">
                        {f.name}
                      </Link>
                      <div className="text-gray-500">{f.error}</div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <button type="button" onClick={() => setResult(null)} className="mt-2 text-gray-500 underline">
            Close
          </button>
        </div>
      )}
    </div>
  );
}
