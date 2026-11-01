"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bulkUpdatePreorders, type BulkPreorderChanges } from "@/app/actions/preorders";
import { refreshPoPrice } from "@/app/actions/snkrdunk";
import ButtonSpinner from "@/app/ButtonSpinner";
import {
  isPoPriceFresh,
  PO_DEFAULT_MARKUP_PERCENT,
  PO_DEFAULT_OPEN_LIMIT,
  PO_MIN_MARKUP_PERCENT,
  type PoMarkupType,
} from "@/lib/preorder";

export type BulkPreorderRow = {
  id: string;
  name: string;
  imageUrl: string | null;
  snkrdunkUrl: string | null;
  storefrontEnabled: boolean;
  poEnabled: boolean;
  poPrice: number | null;
  poPriceUpdatedAt: string | null;
  markupType: PoMarkupType;
  markupValue: number;
  openLimit: number;
  openCount: number;
};

type Filter = "all" | "on" | "off" | "no_link";

// Same spacing as the server-side "Refresh all prices" run
// (lib/preorderPricing.ts) — a few requests, spaced out, not a burst.
const PAUSE_BETWEEN_REFRESHES_MS = 1500;

function idr(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

function formatMarkup(row: BulkPreorderRow) {
  return row.markupType === "percent" ? `${row.markupValue}%` : `+${idr(row.markupValue)}`;
}

// What customers see right now: live (buyable), or why not.
function status(row: BulkPreorderRow): { label: string; className: string } {
  if (!row.poEnabled) return { label: "Off", className: "bg-gray-100 text-gray-600" };
  if (!row.snkrdunkUrl) return { label: "On · no link", className: "bg-red-50 text-red-700" };
  if (row.poPrice === null || !isPoPriceFresh(row.poPriceUpdatedAt))
    return { label: "On · needs price", className: "bg-orange-50 text-orange-800" };
  if (row.openCount >= row.openLimit) return { label: "On · full", className: "bg-orange-50 text-orange-800" };
  if (!row.storefrontEnabled) return { label: "On · hidden", className: "bg-orange-50 text-orange-800" };
  return { label: "Live", className: "bg-green-50 text-green-700" };
}

function needsPrice(row: BulkPreorderRow) {
  return Boolean(row.snkrdunkUrl) && (row.poPrice === null || !isPoPriceFresh(row.poPriceUpdatedAt));
}

export default function BulkPreorderTable({ rows }: { rows: BulkPreorderRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [markupType, setMarkupType] = useState<PoMarkupType>("percent");
  const [markupValue, setMarkupValue] = useState(String(PO_DEFAULT_MARKUP_PERCENT));
  const [openLimit, setOpenLimit] = useState(String(PO_DEFAULT_OPEN_LIMIT));
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (q && !row.name.toLowerCase().includes(q)) return false;
      if (filter === "on") return row.poEnabled;
      if (filter === "off") return !row.poEnabled;
      if (filter === "no_link") return !row.snkrdunkUrl;
      return true;
    });
  }, [rows, query, filter]);

  const allVisibleSelected = visible.length > 0 && visible.every((row) => selected.has(row.id));
  const selectedRows = rows.filter((row) => selected.has(row.id));
  const busy = isPending || progress !== null;

  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  // Fetches fresh SNKRDUNK prices one product at a time from the browser, so
  // a big selection shows progress and can't hit a server timeout.
  async function refreshPrices(targets: BulkPreorderRow[]) {
    const failed: string[] = [];
    for (const [i, row] of targets.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, PAUSE_BETWEEN_REFRESHES_MS));
      setProgress(`Getting SNKRDUNK prices… ${i + 1}/${targets.length}`);
      const result = await refreshPoPrice(row.id);
      if ("error" in result) failed.push(`${row.name}: ${result.error}`);
    }
    setProgress(null);
    return failed;
  }

  function apply(changes: BulkPreorderChanges, describe: string) {
    const targets = selectedRows;
    startTransition(async () => {
      setMessage(null);
      const result = await bulkUpdatePreorders(
        targets.map((row) => row.id),
        changes
      );
      if ("error" in result) {
        setMessage({ text: result.error, error: true });
        return;
      }
      const parts = [`${describe} for ${result.updated} product${result.updated === 1 ? "" : "s"}`];
      if (result.skippedNoLink > 0)
        parts.push(`${result.skippedNoLink} skipped (no SNKRDUNK link — add one on the product page)`);

      // Turning pre-order on only makes a product buyable once it has a
      // fresh price, so fetch any that are missing one straight away.
      if (changes.enabled) {
        const toPrice = targets.filter(needsPrice);
        if (toPrice.length > 0) {
          const failed = await refreshPrices(toPrice);
          parts.push(`${toPrice.length - failed.length}/${toPrice.length} prices fetched`);
          if (failed.length > 0) parts.push(`couldn't price: ${failed.join("; ")}`);
        }
      }
      setMessage({ text: parts.join(" · ") });
      router.refresh();
    });
  }

  function refreshSelected() {
    const targets = selectedRows.filter((row) => row.snkrdunkUrl);
    startTransition(async () => {
      setMessage(null);
      const failed = await refreshPrices(targets);
      setMessage({
        text: [
          `${targets.length - failed.length}/${targets.length} prices fetched`,
          ...(failed.length > 0 ? [`couldn't price: ${failed.join("; ")}`] : []),
        ].join(" · "),
        error: failed.length > 0 && failed.length === targets.length,
      });
      router.refresh();
    });
  }

  const markupNumber = Number(markupValue);
  const markupValid =
    markupValue.trim() !== "" &&
    Number.isFinite(markupNumber) &&
    (markupType === "fixed" || markupNumber >= PO_MIN_MARKUP_PERCENT);
  const limitNumber = Number(openLimit);
  const limitValid = openLimit.trim() !== "" && Number.isInteger(limitNumber) && limitNumber >= 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products"
          className="min-w-48 flex-1 rounded border px-3 py-1.5 text-sm"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="rounded border px-2 py-1.5 text-sm"
        >
          <option value="all">All ({rows.length})</option>
          <option value="on">Pre-order on ({rows.filter((r) => r.poEnabled).length})</option>
          <option value="off">Pre-order off ({rows.filter((r) => !r.poEnabled).length})</option>
          <option value="no_link">No SNKRDUNK link ({rows.filter((r) => !r.snkrdunkUrl).length})</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all shown"
                  checked={allVisibleSelected}
                  onChange={(e) => toggle(visible.map((row) => row.id), e.target.checked)}
                />
              </th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Pre-order price</th>
              <th className="px-3 py-2 text-right font-medium">Markup</th>
              <th className="px-3 py-2 text-right font-medium">Open / limit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((row) => {
              const s = status(row);
              return (
                <tr key={row.id} className={selected.has(row.id) ? "bg-blue-50/40" : undefined}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.name}`}
                      checked={selected.has(row.id)}
                      onChange={(e) => toggle([row.id], e.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {row.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded border object-cover" />
                      ) : (
                        <div className="h-9 w-9 shrink-0 rounded border bg-gray-50" />
                      )}
                      <div className="min-w-0">
                        <Link href={`/zlap-adm/products/${row.id}`} className="font-medium hover:underline">
                          {row.name}
                        </Link>
                        <div className="text-xs text-gray-500">
                          {row.snkrdunkUrl ? (
                            <a href={row.snkrdunkUrl} target="_blank" rel="noopener noreferrer" className="underline">
                              SNKRDUNK ↗
                            </a>
                          ) : (
                            <span className="text-red-600">No SNKRDUNK link</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${s.className}`}>{s.label}</span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                    {row.poPrice === null ? "—" : idr(row.poPrice)}
                    {row.poPrice !== null && !isPoPriceFresh(row.poPriceUpdatedAt) && (
                      <div className="text-xs text-orange-700">stale</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{formatMarkup(row)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.openCount} / {row.openLimit}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  No products match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 flex flex-col gap-3 rounded border bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-gray-500 underline">
              Clear
            </button>
          )}
          <span className="mx-1 h-5 w-px bg-gray-200" />
          <button
            type="button"
            disabled={selected.size === 0 || busy}
            onClick={() => apply({ enabled: true }, "Pre-order turned on")}
            className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
          >
            Turn pre-order on
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || busy}
            onClick={() => apply({ enabled: false }, "Pre-order turned off")}
            className="rounded border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            Turn off
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || busy}
            onClick={refreshSelected}
            className="rounded border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh prices
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Markup</span>
            <select
              value={markupType}
              onChange={(e) => setMarkupType(e.target.value as PoMarkupType)}
              className="rounded border px-2 py-1.5"
            >
              <option value="percent">%</option>
              <option value="fixed">IDR</option>
            </select>
            <input
              type="number"
              value={markupValue}
              min={markupType === "percent" ? PO_MIN_MARKUP_PERCENT : undefined}
              step={markupType === "percent" ? 1 : 1000}
              onChange={(e) => setMarkupValue(e.target.value)}
              className="w-28 rounded border px-2 py-1.5"
            />
            <button
              type="button"
              disabled={selected.size === 0 || busy || !markupValid}
              onClick={() =>
                apply(
                  { markup: { type: markupType, value: markupNumber } },
                  `Markup set to ${markupType === "percent" ? `${markupNumber}%` : idr(markupNumber)}`
                )
              }
              className="rounded border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
            >
              Apply
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Open limit</span>
            <input
              type="number"
              value={openLimit}
              min={0}
              step={1}
              onChange={(e) => setOpenLimit(e.target.value)}
              className="w-20 rounded border px-2 py-1.5"
            />
            <button
              type="button"
              disabled={selected.size === 0 || busy || !limitValid}
              onClick={() => apply({ openLimit: limitNumber }, `Open limit set to ${limitNumber}`)}
              className="rounded border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>

        {markupValid && markupNumber < 0 && (
          <p className="text-xs text-red-700">
            Negative markup — customers pay below the market price. Only for testing.
          </p>
        )}
        {(progress || isPending) && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="relative inline-block h-3 w-3">
              <ButtonSpinner className="h-3 w-3 text-gray-500" />
            </span>
            {progress ?? "Saving…"}
          </div>
        )}
        {message && !busy && (
          <p className={`text-xs ${message.error ? "text-red-600" : "text-gray-700"}`}>{message.text}</p>
        )}
      </div>
    </div>
  );
}
