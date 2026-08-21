"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addPurchaseLine,
  deletePurchaseLine,
  pushToInventory,
} from "@/app/actions/purchases";
import type { Product, PurchaseLine } from "@/lib/types";

function formatMoney(amount: number) {
  return `Rp. ${Math.round(amount || 0).toLocaleString("id-ID")}`;
}

export default function PurchaseLines({
  purchaseId,
  products,
  lines,
  totalFees,
}: {
  purchaseId: string;
  products: Product[];
  lines: PurchaseLine[];
  totalFees: number;
}) {
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [isPending, startTransition] = useTransition();

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const matches = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)
    );
  }, [search, products]);

  const totalItemCost = lines
    .filter((l) => !l.exclude_cost && !l.use_custom_landed_cost)
    .reduce((sum, l) => sum + l.unit_cost * l.qty, 0);

  const anyUnpushed = lines.some((l) => !l.pushed);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded border p-3">
        <label className="mb-1 block text-sm font-medium">Add line — search product</label>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedProductId("");
          }}
          className="mb-2 w-full rounded border px-3 py-2"
          placeholder="Name or SKU"
        />
        {matches.length > 0 && !selectedProductId && (
          <div className="mb-2 flex flex-wrap gap-2">
            {matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedProductId(p.id);
                  setSearch(p.name);
                }}
                className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
              >
                {p.name} ({p.sku})
              </button>
            ))}
          </div>
        )}
        <form
          action={(fd) =>
            startTransition(() => {
              addPurchaseLine(purchaseId, fd).then(() => {
                setSearch("");
                setSelectedProductId("");
              });
            })
          }
          className="grid grid-cols-2 gap-2 sm:grid-cols-5"
        >
          <input type="hidden" name="product_id" value={selectedProductId} />
          <input
            name="qty"
            type="number"
            min={0}
            placeholder="Qty"
            required
            className="rounded border px-2 py-1"
          />
          <input
            name="unit_cost"
            type="number"
            min={0}
            placeholder="Unit cost"
            required
            className="rounded border px-2 py-1"
          />
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="exclude_cost" /> Exclude fee
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="use_custom_landed_cost" /> Custom fee
          </label>
          <input
            name="custom_landed_cost"
            type="number"
            min={0}
            placeholder="Custom fee amount"
            className="rounded border px-2 py-1"
          />
          <button
            type="submit"
            disabled={!selectedProductId || isPending}
            className="col-span-2 rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50 sm:col-span-1"
          >
            Add line
          </button>
        </form>
      </div>

      <div className="divide-y rounded border">
        {lines.map((line) => {
          const product = productById.get(line.product_id);
          const allocatedFee = line.exclude_cost
            ? 0
            : line.use_custom_landed_cost
              ? Number(line.custom_landed_cost) || 0
              : totalItemCost > 0
                ? Math.round((line.unit_cost / totalItemCost) * totalFees)
                : 0;
          const landedCost = line.unit_cost + allocatedFee;

          return (
            <div key={line.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{product?.name ?? line.product_id}</div>
                <div className="text-gray-500">
                  qty {line.qty} × {formatMoney(line.unit_cost)} · landed{" "}
                  {formatMoney(landedCost)}
                  {line.pushed && <span className="ml-2 text-green-700">pushed</span>}
                </div>
              </div>
              {!line.pushed && (
                <button
                  type="button"
                  onClick={() => startTransition(() => deletePurchaseLine(purchaseId, line.id))}
                  className="text-red-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
        {lines.length === 0 && (
          <div className="px-3 py-6 text-sm text-gray-500">No lines yet.</div>
        )}
      </div>

      <button
        type="button"
        disabled={!anyUnpushed || isPending}
        onClick={() => startTransition(() => pushToInventory(purchaseId))}
        className="self-start rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {isPending ? "Pushing…" : "Push unpushed lines to inventory"}
      </button>
    </div>
  );
}
