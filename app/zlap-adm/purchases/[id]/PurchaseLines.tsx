"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addPurchaseLine,
  deletePurchaseLine,
  pushToInventory,
  updatePurchaseLine,
} from "@/app/actions/purchases";
import ButtonSpinner from "@/app/ButtonSpinner";
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
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [finalPriceOverrides, setFinalPriceOverrides] = useState<Record<string, number>>({});

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
            className="relative col-span-2 rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50 sm:col-span-1"
          >
            <span className={isPending ? "invisible" : ""}>Add line</span>
            {isPending && <ButtonSpinner />}
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="w-full min-w-[1020px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Unit cost</th>
              <th className="px-3 py-2 text-right font-medium">Fee</th>
              <th className="px-3 py-2 text-right font-medium">Landed</th>
              <th className="px-3 py-2 text-right font-medium">
                Market est.
                <div className="normal-case text-[10px] font-normal">no profit</div>
              </th>
              <th className="px-3 py-2 text-right font-medium">
                Final price
                <div className="normal-case text-[10px] font-normal">editable, not saved</div>
              </th>
              <th className="px-3 py-2 text-right font-medium">
                Net income
                <div className="normal-case text-[10px] font-normal">final − market est.</div>
              </th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
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

              if (editingLineId === line.id) {
                return (
                  <tr key={line.id}>
                    <td colSpan={10} className="px-3 py-3">
                      <form
                        action={(fd) =>
                          startTransition(() => {
                            updatePurchaseLine(purchaseId, line.id, fd).then(() => {
                              setEditingLineId(null);
                            });
                          })
                        }
                        className="flex flex-col gap-2"
                      >
                        <div className="font-medium">{product?.name ?? line.product_id}</div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                          <input
                            name="qty"
                            type="number"
                            min={0}
                            defaultValue={line.qty}
                            placeholder="Qty"
                            required
                            className="rounded border px-2 py-1"
                          />
                          <input
                            name="unit_cost"
                            type="number"
                            min={0}
                            defaultValue={line.unit_cost}
                            placeholder="Unit cost"
                            required
                            className="rounded border px-2 py-1"
                          />
                          <label className="flex items-center gap-1 text-sm">
                            <input
                              type="checkbox"
                              name="exclude_cost"
                              defaultChecked={line.exclude_cost}
                            />{" "}
                            Exclude fee
                          </label>
                          <label className="flex items-center gap-1 text-sm">
                            <input
                              type="checkbox"
                              name="use_custom_landed_cost"
                              defaultChecked={line.use_custom_landed_cost}
                            />{" "}
                            Custom fee
                          </label>
                          <input
                            name="custom_landed_cost"
                            type="number"
                            min={0}
                            defaultValue={line.custom_landed_cost ?? ""}
                            placeholder="Custom fee amount"
                            className="rounded border px-2 py-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={isPending}
                            className="relative rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
                          >
                            <span className={isPending ? "invisible" : ""}>Save</span>
                            {isPending && <ButtonSpinner />}
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => setEditingLineId(null)}
                            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                );
              }

              const marketEst = landedCost * 1.18;
              const defaultFinalPrice = marketEst * 1.1;
              const finalPrice = finalPriceOverrides[line.id] ?? defaultFinalPrice;
              const netIncome = finalPrice - marketEst;

              const badges: { label: string; className: string }[] = [];
              if (line.exclude_cost) {
                badges.push({ label: "Fee excluded", className: "bg-gray-100 text-gray-700" });
              } else if (line.use_custom_landed_cost) {
                badges.push({ label: "Custom fee", className: "bg-amber-100 text-amber-800" });
              }
              if (line.pushed) {
                badges.push({ label: "Pushed", className: "bg-green-100 text-green-700" });
              }

              return (
                <tr key={line.id}>
                  <td className="px-3 py-2 font-medium">{product?.name ?? line.product_id}</td>
                  <td className="px-3 py-2 text-right">{line.qty}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(line.unit_cost)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(allocatedFee)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(landedCost)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(marketEst)}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      value={Math.round(finalPrice)}
                      onChange={(e) =>
                        setFinalPriceOverrides((prev) => ({
                          ...prev,
                          [line.id]: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-28 rounded border px-2 py-1 text-right"
                    />
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-medium ${
                      netIncome >= 0 ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {formatMoney(netIncome)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {badges.map((b) => (
                        <span
                          key={b.label}
                          className={`rounded px-1.5 py-0.5 text-xs ${b.className}`}
                        >
                          {b.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!line.pushed && (
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingLineId(line.id)}
                          className="text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            startTransition(() => deletePurchaseLine(purchaseId, line.id))
                          }
                          className="text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-sm text-gray-500">
                  No lines yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        disabled={!anyUnpushed || isPending}
        onClick={() => startTransition(() => pushToInventory(purchaseId))}
        className="relative self-start rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        <span className={isPending ? "invisible" : ""}>Push unpushed lines to inventory</span>
        {isPending && <ButtonSpinner />}
      </button>
    </div>
  );
}
