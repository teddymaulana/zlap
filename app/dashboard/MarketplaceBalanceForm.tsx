"use client";

import { useState, useTransition } from "react";
import { updateMarketplaceBalances } from "@/app/actions/dashboard";

export default function MarketplaceBalanceForm({
  shopeeToSettle,
  tokopediaToSettle,
}: {
  shopeeToSettle: number;
  tokopediaToSettle: number;
}) {
  const [shopee, setShopee] = useState(shopeeToSettle);
  const [tokopedia, setTokopedia] = useState(tokopediaToSettle);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    const fd = new FormData();
    fd.set("shopee_to_settle", String(shopee));
    fd.set("tokopedia_to_settle", String(tokopedia));
    startTransition(() => updateMarketplaceBalances(fd));
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
      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="self-start rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
