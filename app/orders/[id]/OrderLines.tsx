"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { addOrderLine, removeOrderLine, updateOrderLinePrice } from "@/app/actions/orders";
import type { InventoryBatchAvailability, OrderLine, Product } from "@/lib/types";

function formatMoney(amount: number) {
  return `Rp. ${Math.round(amount || 0).toLocaleString("id-ID")}`;
}

export default function OrderLines({
  orderId,
  products,
  batches,
  lines,
}: {
  orderId: string;
  products: Product[];
  batches: InventoryBatchAvailability[];
  lines: OrderLine[];
}) {
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const matches = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)
    );
  }, [search, products]);

  const batchesForSelected = useMemo(() => {
    if (!selectedProductId) return [];
    return batches
      .filter((b) => b.product_id === selectedProductId)
      .sort((a, b) => Number(b.available > 0) - Number(a.available > 0));
  }, [selectedProductId, batches]);

  const grandTotal = lines.reduce((sum, l) => sum + (l.price ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded border bg-gray-50 p-4">
        <div className="text-sm text-gray-600">Quantity</div>
        <div className="text-lg font-semibold">{lines.length}</div>
        <div className="mt-2 text-sm text-gray-600">Grand total</div>
        <div className="text-lg font-semibold">{formatMoney(grandTotal)}</div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Search product</label>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedProductId(null);
          }}
          className="w-full rounded border px-3 py-2"
          placeholder="Name or SKU"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {matches.length > 0 && !selectedProductId && (
        <div className="flex flex-wrap gap-2">
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedProductId(p.id)}
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
            >
              {p.name} ({p.sku})
            </button>
          ))}
        </div>
      )}

      {selectedProductId && (
        <div className="grid grid-cols-2 gap-2">
          {batchesForSelected.map((b) => {
            const soldOut = b.available <= 0;
            return (
              <button
                key={b.id}
                type="button"
                disabled={soldOut || isPending}
                onClick={() => {
                  setError("");
                  startTransition(async () => {
                    try {
                      await addOrderLine(orderId, selectedProductId, b.id, 0);
                      setSearch("");
                      setSelectedProductId(null);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Failed to add line");
                    }
                  });
                }}
                className="rounded border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="text-xs font-semibold">
                  {soldOut ? "SOLD OUT" : `${b.available} available`}
                </div>
                <div className="font-medium">{formatMoney(b.cost)}</div>
                <div className="text-xs text-gray-500">
                  Batch qty {b.qty} · acquired {b.acquired_date}
                  {b.locked ? " · locked" : ""}
                </div>
              </button>
            );
          })}
          {batchesForSelected.length === 0 && (
            <div className="col-span-2 text-sm text-gray-500">No batches for this product.</div>
          )}
        </div>
      )}

      <div className="divide-y rounded border">
        {lines.map((line) => {
          const product = productById.get(line.product_id);
          const batch = batches.find((b) => b.id === line.inventory_batch_id);
          return (
            <div key={line.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {product ? (
                    <Link href={`/products/${product.id}`} className="hover:underline">
                      {product.name}
                    </Link>
                  ) : (
                    line.product_id
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {batch && `cost ${formatMoney(batch.cost)} · `}
                  net profit {formatMoney((line.price ?? 0) - (batch?.cost ?? 0))}
                </div>
              </div>
              <input
                type="number"
                defaultValue={line.price ?? 0}
                onBlur={(e) =>
                  startTransition(() =>
                    updateOrderLinePrice(orderId, line.id, Number(e.target.value) || 0)
                  )
                }
                className="w-28 rounded border px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => startTransition(() => removeOrderLine(orderId, line.id))}
                className="text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          );
        })}
        {lines.length === 0 && (
          <div className="px-3 py-6 text-sm text-gray-500">No lines yet.</div>
        )}
      </div>
    </div>
  );
}
