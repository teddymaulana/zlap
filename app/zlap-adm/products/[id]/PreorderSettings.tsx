"use client";

import { useState, useTransition } from "react";
import { dismissPoPriceAlert, refreshPoPrice } from "@/app/actions/snkrdunk";
import ButtonSpinner from "@/app/ButtonSpinner";
import {
  computePoPrice,
  hasPoPriceIncrease,
  isPoPriceFresh,
  PO_DEFAULT_MARKUP_PERCENT,
  PO_DEFAULT_OPEN_LIMIT,
  PO_MIN_MARKUP_PERCENT,
  PO_ESTIMATE_WEEKS,
  PO_PRICE_MAX_AGE_DAYS,
  type PoMarkupType,
} from "@/lib/preorder";
import type { Product } from "@/lib/types";

function idr(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

// Pre-order settings inside ProductHeaderForm — the inputs are submitted
// with the rest of the product form (updateProduct). "Refresh price now" is
// separate and immediate (refreshPoPrice).
export default function PreorderSettings({ product, openCount }: { product: Product; openCount: number }) {
  const [enabled, setEnabled] = useState(product.po_enabled);
  const [markupType, setMarkupType] = useState<PoMarkupType>(product.po_markup_type ?? "percent");
  const [markupValue, setMarkupValue] = useState(String(product.po_markup_value ?? PO_DEFAULT_MARKUP_PERCENT));
  const [openLimit, setOpenLimit] = useState(String(product.po_open_limit ?? PO_DEFAULT_OPEN_LIMIT));
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const hasSnapshot = product.po_base_jpy !== null && product.po_fx_rate !== null;
  // Live preview of what the saved snapshot would sell at with the markup
  // currently typed in — the stored po_price only changes on Save.
  const previewPrice = hasSnapshot
    ? computePoPrice(Number(product.po_base_jpy), Number(product.po_fx_rate), markupType, Number(markupValue) || 0)
    : null;
  const fresh = isPoPriceFresh(product.po_price_updated_at);
  const priceWentUp = hasPoPriceIncrease(product);

  return (
    <div className="flex flex-col gap-2 rounded border p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="po_enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Open for pre-order (PSA 10, sourced from Japan)
      </label>
      <p className="text-xs text-gray-500">
        Customers can pre-order even when out of stock, pay in full, and get it in about {PO_ESTIMATE_WEEKS.min}–
        {PO_ESTIMATE_WEEKS.max} weeks. Needs a SNKRDUNK link above; the price is refreshed every 3 days from recent PSA 10
        sales.
      </p>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-600">Markup</span>
        <select
          name="po_markup_type"
          value={markupType}
          onChange={(e) => {
            const next = e.target.value as PoMarkupType;
            setMarkupType(next);
            if (next === "percent" && Number(markupValue) > 1000) setMarkupValue(String(PO_DEFAULT_MARKUP_PERCENT));
          }}
          className="rounded border px-2 py-1.5 text-sm"
        >
          <option value="percent">Percentage (%)</option>
          <option value="fixed">Fixed amount (IDR)</option>
        </select>
        <input
          name="po_markup_value"
          type="number"
          min={markupType === "percent" ? PO_MIN_MARKUP_PERCENT : undefined}
          step={markupType === "percent" ? 1 : 1000}
          value={markupValue}
          onChange={(e) => setMarkupValue(e.target.value)}
          className="w-32 rounded border px-2 py-1.5 text-sm"
        />
        <span className="text-gray-500">{markupType === "percent" ? "%" : "IDR"}</span>
      </div>

      {(Number(markupValue) || 0) < 0 && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          Negative markup — customers pay below the market price. Only for testing; set it back before real
          customers can order.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-600">Open pre-order limit</span>
        <input
          name="po_open_limit"
          type="number"
          min={0}
          step={1}
          value={openLimit}
          onChange={(e) => setOpenLimit(e.target.value)}
          className="w-20 rounded border px-2 py-1.5 text-sm"
        />
        <span className={`text-xs ${openCount >= (Number(openLimit) || 0) ? "text-red-600" : "text-gray-500"}`}>
          {openCount} open now (not yet received){openCount >= (Number(openLimit) || 0) ? " — full, hidden from customers" : ""}
        </span>
      </div>

      {priceWentUp && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          <span>
            Pre-order price went up: {idr(Number(product.po_price_previous))} → {idr(Number(product.po_price))} (
            {Math.round((Number(product.po_price) / Number(product.po_price_previous) - 1) * 100)}%)
            {openCount > 0 && ` · ${openCount} open pre-order${openCount === 1 ? " was" : "s were"} sold at an earlier price`}
          </span>
          <button
            type="button"
            onClick={() => startRefresh(async () => void (await dismissPoPriceAlert(product.id)))}
            className="rounded border border-orange-300 bg-white px-2 py-1 text-xs hover:bg-orange-100"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded bg-gray-50 px-3 py-2 text-sm">
        {hasSnapshot ? (
          <>
            <div>
              Pre-order price: <span className="font-semibold">{idr(previewPrice!)}</span>
              {previewPrice !== Number(product.po_price) && (
                <span className="text-xs text-gray-500"> (saved: {product.po_price ? idr(Number(product.po_price)) : "—"}, Save to apply)</span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              Market ¥{Number(product.po_base_jpy).toLocaleString("en-US")} × {Number(product.po_fx_rate).toFixed(1)}{" "}
              IDR/¥ = {idr(Number(product.po_base_jpy) * Number(product.po_fx_rate))} before markup · updated{" "}
              {new Date(product.po_price_updated_at!).toLocaleString("id-ID", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Jakarta",
              })}
            </div>
            {!fresh && (
              <div className="text-xs text-red-600">
                Older than {PO_PRICE_MAX_AGE_DAYS} days — hidden from customers until refreshed.
              </div>
            )}
          </>
        ) : (
          <span className="text-xs text-gray-500">No price yet — save a SNKRDUNK link, then refresh.</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isRefreshing || !product.snkrdunk_url}
          onClick={() =>
            startRefresh(async () => {
              const result = await refreshPoPrice(product.id);
              setRefreshMessage("error" in result ? result.error : `Refreshed — now ${idr(result.price)}`);
            })
          }
          className="relative self-start rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <span className={isRefreshing ? "invisible" : ""}>Refresh price now</span>
          {isRefreshing && <ButtonSpinner className="h-3 w-3" />}
        </button>
        {refreshMessage && <span className="text-xs text-gray-600">{refreshMessage}</span>}
      </div>
    </div>
  );
}
