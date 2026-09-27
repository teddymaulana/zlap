"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPoPurchase } from "@/app/actions/preorders";
import ButtonSpinner from "@/app/ButtonSpinner";

export type QueueGroup = {
  productId: string;
  name: string;
  imageUrl: string | null;
  snkrdunkUrl: string | null;
  lines: {
    id: string;
    orderInternalId: string;
    orderCode: string;
    customerName: string | null;
    date: string | null;
    price: number | null;
  }[];
};

function formatMoney(amount: number | null) {
  return amount === null ? "—" : `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

export default function PreorderQueue({ groups }: { groups: QueueGroup[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (groups.length === 0) {
    return <div className="rounded border px-4 py-6 text-center text-sm text-gray-500">Nothing waiting to be bought.</div>;
  }

  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const ids = group.lines.map((l) => l.id);
        const allOn = ids.every((id) => selected.has(id));
        return (
          <div key={group.productId} className="rounded border">
            <label className="flex items-center gap-3 border-b bg-gray-50 px-4 py-2">
              <input type="checkbox" checked={allOn} onChange={(e) => toggle(ids, e.target.checked)} />
              {group.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={group.imageUrl} alt="" className="h-10 w-10 rounded border object-cover" />
              )}
              <span className="min-w-0 flex-1 text-sm font-medium">
                {group.name} <span className="text-gray-500">× {group.lines.length}</span>
              </span>
              {group.snkrdunkUrl && (
                <a
                  href={group.snkrdunkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-600 underline"
                >
                  SNKRDUNK ↗
                </a>
              )}
            </label>
            <div className="divide-y">
              {group.lines.map((line) => (
                <label key={line.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(line.id)}
                    onChange={(e) => toggle([line.id], e.target.checked)}
                  />
                  <Link href={`/zlap-adm/orders/${line.orderInternalId}`} className="font-mono text-xs underline">
                    {line.orderCode}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-gray-600">{line.customerName || "Guest"}</span>
                  <span className="text-xs text-gray-500">
                    {line.date ? new Date(line.date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) : ""}
                  </span>
                  <span className="tabular-nums">{formatMoney(line.price)}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={selected.size === 0 || isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await createPoPurchase([...selected]);
              if ("error" in result) setError(result.error);
              else router.push(`/zlap-adm/purchases/${result.purchaseId}`);
            })
          }
          className="relative rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          <span className={isPending ? "invisible" : ""}>Create purchase from {selected.size} selected</span>
          {isPending && <ButtonSpinner />}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
