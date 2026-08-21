"use client";

import { useState, useTransition } from "react";
import {
  addInventoryBatch,
  deleteInventoryBatch,
  updateInventoryBatch,
} from "@/app/actions/products";
import type { InventoryBatchAvailability } from "@/lib/types";

function formatMoney(amount: number) {
  return `Rp. ${Math.round(amount || 0).toLocaleString("id-ID")}`;
}

type Draft = {
  qty: number;
  cost: number;
  fee_pct: number;
  add_up_pct: number;
  acquired_date: string;
  locked: boolean;
};

function toDraft(b: InventoryBatchAvailability): Draft {
  return {
    qty: b.qty,
    cost: b.cost,
    fee_pct: b.fee_pct,
    add_up_pct: b.add_up_pct,
    acquired_date: b.acquired_date ?? "",
    locked: b.locked,
  };
}

function BatchRow({
  productId,
  batch,
}: {
  productId: string;
  batch: InventoryBatchAvailability;
}) {
  const [draft, setDraft] = useState<Draft>(toDraft(batch));
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const sold = batch.qty - batch.available;
  const available = Math.max(0, batch.available);

  const costPlusFee = draft.cost + draft.cost * (draft.fee_pct / 100);
  const estTokpedPrice = costPlusFee + draft.cost * (draft.add_up_pct / 100);
  const net = draft.cost * (draft.add_up_pct / 100);
  const directPrice = draft.cost * 1.1;

  const save = () => {
    const fd = new FormData();
    fd.set("qty", String(draft.qty));
    fd.set("cost", String(draft.cost));
    fd.set("fee_pct", String(draft.fee_pct));
    fd.set("add_up_pct", String(draft.add_up_pct));
    fd.set("acquired_date", draft.acquired_date);
    if (draft.locked) fd.set("locked", "on");
    startTransition(() => updateInventoryBatch(productId, batch.id, fd));
  };

  return (
    <div className="rounded border p-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-sm text-gray-600"
      >
        <div className="flex items-center gap-4">
          <span className="text-gray-400">{open ? "▾" : "▸"}</span>
          <span>{available} available</span>
          <span>{sold} sold</span>
          <span>{formatMoney(batch.cost)}</span>
          <span>{batch.acquired_date}</span>
        </div>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            startTransition(() => deleteInventoryBatch(productId, batch.id));
          }}
          className="text-red-600 hover:underline"
        >
          Delete
        </span>
      </button>

      {open && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          Acquired date
          <input
            type="date"
            disabled={draft.locked}
            value={draft.acquired_date}
            onChange={(e) => setDraft({ ...draft, acquired_date: e.target.value })}
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Batch qty
          <input
            type="number"
            min={0}
            disabled={draft.locked}
            value={draft.qty}
            onChange={(e) => setDraft({ ...draft, qty: Number(e.target.value) || 0 })}
            className="rounded border px-2 py-1"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          Sold
          <div className="rounded border bg-gray-50 px-2 py-1">{sold}</div>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          Available
          <div className="rounded border bg-gray-50 px-2 py-1">{available}</div>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          Total value
          <div className="rounded border bg-gray-50 px-2 py-1">
            {formatMoney(available * draft.cost)}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Unit + landed cost
          <input
            type="number"
            min={0}
            disabled={draft.locked}
            value={draft.cost}
            onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) || 0 })}
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fee (%)
          <input
            type="number"
            min={0}
            disabled={draft.locked}
            value={draft.fee_pct}
            onChange={(e) => setDraft({ ...draft, fee_pct: Number(e.target.value) || 0 })}
            className="rounded border px-2 py-1"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          Cost + platform fee
          <div className="rounded border bg-gray-50 px-2 py-1">{formatMoney(costPlusFee)}</div>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Add up (%)
          <input
            type="number"
            min={0}
            disabled={draft.locked}
            value={draft.add_up_pct}
            onChange={(e) => setDraft({ ...draft, add_up_pct: Number(e.target.value) || 0 })}
            className="rounded border px-2 py-1"
          />
        </label>

        <div className="flex flex-col gap-1 text-sm">
          Est. Tokped price
          <div className="rounded border bg-gray-50 px-2 py-1">{formatMoney(estTokpedPrice)}</div>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          Direct price (110%)
          <div className="rounded border bg-gray-50 px-2 py-1">{formatMoney(directPrice)}</div>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          Net
          <div className="rounded border bg-gray-50 px-2 py-1">{formatMoney(net)}</div>
        </div>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="mt-3 rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save batch"}
          </button>
        </>
      )}
    </div>
  );
}

export default function ProductBatches({
  productId,
  batches,
}: {
  productId: string;
  batches: InventoryBatchAvailability[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {batches.map((b) => (
        <BatchRow key={b.id} productId={productId} batch={b} />
      ))}
      <button
        type="button"
        onClick={() => startTransition(() => addInventoryBatch(productId))}
        disabled={isPending}
        className="self-start rounded border px-3 py-2 text-sm"
      >
        Add batch
      </button>
    </div>
  );
}
