"use client";

import { useState, useTransition } from "react";
import { createSnapshot, updateMarketplaceBalances } from "@/app/actions/dashboard";

export default function MarketplaceBalanceForm({
  shopeeToSettle,
  tokopediaToSettle,
  totalValue,
  depositToPay,
}: {
  shopeeToSettle: number;
  tokopediaToSettle: number;
  totalValue: number;
  depositToPay: number;
}) {
  const [shopee, setShopee] = useState(shopeeToSettle);
  const [tokopedia, setTokopedia] = useState(tokopediaToSettle);
  const [isSavePending, startSaveTransition] = useTransition();
  const [isSnapshotPending, startSnapshotTransition] = useTransition();

  const save = () => {
    const fd = new FormData();
    fd.set("shopee_to_settle", String(shopee));
    fd.set("tokopedia_to_settle", String(tokopedia));
    startSaveTransition(() => updateMarketplaceBalances(fd));
  };

  const snapshot = () => {
    const fd = new FormData();
    fd.set("totalValue", String(totalValue));
    fd.set("depositToPay", String(depositToPay));
    startSnapshotTransition(() => createSnapshot(fd));
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex items-center justify-between gap-2">
        <span className="text-gray-500">Shopee To Settle</span>
        <input
          type="number"
          min={0}
          value={shopee}
          onChange={(e) => setShopee(Number(e.target.value) || 0)}
          className="w-32 rounded border px-2 py-1 text-right"
        />
      </label>
      <label className="flex items-center justify-between gap-2">
        <span className="text-gray-500">Tokopedia To Settle</span>
        <input
          type="number"
          min={0}
          value={tokopedia}
          onChange={(e) => setTokopedia(Number(e.target.value) || 0)}
          className="w-32 rounded border px-2 py-1 text-right"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isSavePending}
          className="rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-50"
        >
          {isSavePending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={snapshot}
          disabled={isSnapshotPending}
          className="rounded border px-3 py-1 text-xs disabled:opacity-50"
        >
          {isSnapshotPending ? "Saving…" : "Snapshot"}
        </button>
      </div>
    </div>
  );
}
