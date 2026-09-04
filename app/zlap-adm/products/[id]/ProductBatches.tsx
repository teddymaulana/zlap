"use client";

import { useState, useTransition } from "react";
import {
  addInventoryBatch,
  deleteInventoryBatch,
  setStorefrontPriceBatch,
  updateInventoryBatch,
} from "@/app/actions/products";
import ButtonSpinner from "@/app/ButtonSpinner";
import type { InventoryBatchAvailability } from "@/lib/types";

function formatMoney(amount: number) {
  return `Rp. ${Math.round(amount || 0).toLocaleString("id-ID")}`;
}

const DEFAULT_DIRECT_PRICE_PCT = 1.15;
const DEFAULT_PREORDER_DAYS = 30;

type Draft = {
  qty: number;
  cost: number;
  fee_pct: number;
  add_up_pct: number;
  acquired_date: string;
  locked: boolean;
  direct_price: number | null;
  is_preorder: boolean;
  preorder_mode: "duration" | "date";
  preorder_duration_days: number;
  preorder_arrival_date: string;
  storefront_qty_limit: number | null;
};

function toDraft(b: InventoryBatchAvailability): Draft {
  return {
    qty: b.qty,
    cost: b.cost,
    fee_pct: b.fee_pct,
    add_up_pct: b.add_up_pct,
    acquired_date: b.acquired_date ?? "",
    locked: b.locked,
    direct_price: b.direct_price,
    is_preorder: b.is_preorder,
    preorder_mode: b.preorder_arrival_date ? "date" : "duration",
    preorder_duration_days: b.preorder_duration_days ?? DEFAULT_PREORDER_DAYS,
    preorder_arrival_date: b.preorder_arrival_date ?? "",
    storefront_qty_limit: b.storefront_qty_limit,
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
  const [isStorefrontPending, startStorefrontTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const sold = batch.qty - batch.available;
  const available = Math.max(0, batch.available);

  const costPlusFee = draft.cost + draft.cost * (draft.fee_pct / 100);
  const estTokpedPrice = costPlusFee + draft.cost * (draft.add_up_pct / 100);
  const net = draft.cost * (draft.add_up_pct / 100);
  const directPrice = draft.direct_price ?? draft.cost * DEFAULT_DIRECT_PRICE_PCT;

  const save = () => {
    const fd = new FormData();
    fd.set("qty", String(draft.qty));
    fd.set("cost", String(draft.cost));
    fd.set("fee_pct", String(draft.fee_pct));
    fd.set("add_up_pct", String(draft.add_up_pct));
    fd.set("acquired_date", draft.acquired_date);
    if (draft.locked) fd.set("locked", "on");
    if (draft.direct_price !== null) fd.set("direct_price", String(draft.direct_price));
    if (draft.is_preorder) {
      fd.set("is_preorder", "on");
      if (draft.preorder_mode === "duration") {
        fd.set("preorder_duration_days", String(draft.preorder_duration_days));
      } else {
        fd.set("preorder_arrival_date", draft.preorder_arrival_date);
      }
    }
    if (draft.storefront_qty_limit !== null) {
      fd.set("storefront_qty_limit", String(draft.storefront_qty_limit));
    }
    startTransition(() => updateInventoryBatch(productId, batch.id, fd));
  };

  return (
    <div
      className={`rounded border p-4 ${
        batch.is_storefront_price ? "border-green-300 bg-green-50" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-sm text-gray-600"
      >
        <div className="flex items-center gap-4">
          <span className="text-gray-400">{open ? "▾" : "▸"}</span>
          <span>{available} available</span>
          <span>{sold} sold</span>
          {batch.storefront_qty_limit !== null && (
            <span className="text-gray-400">
              ({Math.max(0, batch.storefront_available)} for storefront)
            </span>
          )}
          <span>{formatMoney(batch.cost)}</span>
          <span>{batch.acquired_date}</span>
          {batch.is_storefront_price && (
            <span className="rounded bg-green-200 px-1.5 py-0.5 text-xs font-medium text-green-800">
              Storefront price
            </span>
          )}
          {batch.is_preorder && (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
              Pre-order
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {batch.is_storefront_price ? (
            <span className="rounded border border-green-300 bg-green-200 px-2 py-1 text-xs text-green-800">
              ✓ Used in storefront
            </span>
          ) : (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                startStorefrontTransition(() => setStorefrontPriceBatch(productId, batch.id, false));
              }}
              className={`rounded border px-2 py-1 text-xs hover:bg-gray-50 ${
                isStorefrontPending ? "opacity-50" : ""
              }`}
            >
              Use for storefront
            </span>
          )}
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
        </div>
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
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center justify-between">
            Storefront limit
            {draft.storefront_qty_limit !== null && (
              <button
                type="button"
                onClick={() => setDraft({ ...draft, storefront_qty_limit: null })}
                className="text-xs font-normal text-gray-500 hover:underline"
              >
                Reset
              </button>
            )}
          </span>
          <input
            type="number"
            min={0}
            disabled={draft.locked}
            value={draft.storefront_qty_limit ?? ""}
            placeholder="No limit"
            onChange={(e) =>
              setDraft({
                ...draft,
                storefront_qty_limit: e.target.value === "" ? null : Number(e.target.value) || 0,
              })
            }
            className="rounded border px-2 py-1"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          Storefront available
          <div className="rounded border bg-gray-50 px-2 py-1">
            {Math.max(0, batch.storefront_available)}
          </div>
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
          Net
          <div className="rounded border bg-gray-50 px-2 py-1">{formatMoney(net)}</div>
        </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1 text-sm">
          <span className="flex items-center justify-between">
            Direct price
            {draft.direct_price !== null && (
              <button
                type="button"
                onClick={() => setDraft({ ...draft, direct_price: null })}
                className="text-xs font-normal text-gray-500 hover:underline"
              >
                Reset
              </button>
            )}
          </span>
          <input
            type="number"
            min={0}
            disabled={draft.locked}
            value={Math.round(directPrice)}
            onChange={(e) => setDraft({ ...draft, direct_price: Number(e.target.value) || 0 })}
            className="rounded border px-2 py-1"
          />
        </div>
        <div className="flex flex-col gap-1 text-sm">
          Direct price net
          <div className="rounded border bg-gray-50 px-2 py-1">
            {formatMoney(directPrice - draft.cost)}
          </div>
        </div>
          </div>

          <div className="mt-3 rounded border p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={draft.locked}
                checked={draft.is_preorder}
                onChange={(e) => setDraft({ ...draft, is_preorder: e.target.checked })}
              />
              This batch is pre-order
            </label>

            {draft.is_preorder && (
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`preorder-mode-${batch.id}`}
                    checked={draft.preorder_mode === "duration"}
                    onChange={() => setDraft({ ...draft, preorder_mode: "duration" })}
                  />
                  Estimate by duration after order
                </label>
                {draft.preorder_mode === "duration" && (
                  <div className="ml-6 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={draft.preorder_duration_days}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          preorder_duration_days: Number(e.target.value) || DEFAULT_PREORDER_DAYS,
                        })
                      }
                      className="w-24 rounded border px-2 py-1"
                    />
                    <span className="text-gray-500">days (default {DEFAULT_PREORDER_DAYS})</span>
                  </div>
                )}

                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`preorder-mode-${batch.id}`}
                    checked={draft.preorder_mode === "date"}
                    onChange={() => setDraft({ ...draft, preorder_mode: "date" })}
                  />
                  Estimate by exact arrival date
                </label>
                {draft.preorder_mode === "date" && (
                  <input
                    type="date"
                    value={draft.preorder_arrival_date}
                    onChange={(e) => setDraft({ ...draft, preorder_arrival_date: e.target.value })}
                    className="ml-6 w-fit rounded border px-2 py-1"
                  />
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="relative mt-3 rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            <span className={isPending ? "invisible" : ""}>Save batch</span>
            {isPending && <ButtonSpinner />}
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
        className="relative self-start rounded border px-3 py-2 text-sm disabled:opacity-50"
      >
        <span className={isPending ? "invisible" : ""}>Add batch</span>
        {isPending && <ButtonSpinner />}
      </button>
    </div>
  );
}
