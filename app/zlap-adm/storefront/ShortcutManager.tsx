"use client";

import { useState, useTransition } from "react";
import {
  addStorefrontShortcut,
  removeStorefrontShortcut,
  reorderStorefrontShortcut,
  updateStorefrontShortcut,
  updateStorefrontShortcutBadge,
  uploadStorefrontShortcutImage,
} from "@/app/actions/products";
import { PRODUCT_BRANDS } from "@/lib/constants";
import type { CardSet, StorefrontShortcut, StorefrontShortcutBadge } from "@/lib/types";
import ButtonSpinner from "@/app/ButtonSpinner";

type Candidate = { id: string; name: string; sku: string | null };

const CATEGORIES = [
  { value: "booster_boxes", label: "Booster Boxes" },
  { value: "singles", label: "Singles" },
  { value: "slabs", label: "Slabs" },
  { value: "other", label: "Other" },
];

const BADGES: { value: StorefrontShortcutBadge | ""; label: string }[] = [
  { value: "", label: "None" },
  { value: "fire", label: "🔥 Fire" },
  { value: "new", label: "New" },
  { value: "sale", label: "Sale" },
];

type LinkType = "category" | "product" | "search" | "custom";

function ShortcutRow({
  shortcut,
  isFirst,
  isLast,
}: {
  shortcut: StorefrontShortcut;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isUploadPending, startUploadTransition] = useTransition();
  const [isRemovePending, startRemoveTransition] = useTransition();
  const [isBadgePending, startBadgeTransition] = useTransition();
  const [isReorderPending, startReorderTransition] = useTransition();
  const [isEditPending, startEditTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(shortcut.label);
  const [editHref, setEditHref] = useState(shortcut.href);

  if (isEditing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!editLabel.trim() || !editHref.trim()) return;
          startEditTransition(async () => {
            await updateStorefrontShortcut(shortcut.id, editLabel, editHref);
            setIsEditing(false);
          });
        }}
        className="flex items-center gap-2 rounded border px-3 py-2"
      >
        <input
          type="text"
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          placeholder="Label"
          className="w-32 rounded border px-2 py-1 text-sm"
        />
        <input
          type="text"
          value={editHref}
          onChange={(e) => setEditHref(e.target.value)}
          placeholder="/products/... or https://..."
          className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={isEditPending || !editLabel.trim() || !editHref.trim()}
          className="relative rounded bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50"
        >
          <span className={isEditPending ? "invisible" : ""}>Save</span>
          {isEditPending && <ButtonSpinner className="h-3 w-3" />}
        </button>
        <button
          type="button"
          disabled={isEditPending}
          onClick={() => {
            setEditLabel(shortcut.label);
            setEditHref(shortcut.href);
            setIsEditing(false);
          }}
          className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded border px-3 py-2">
      <div className="flex flex-col">
        <button
          type="button"
          disabled={isReorderPending || isFirst}
          onClick={() => startReorderTransition(() => reorderStorefrontShortcut(shortcut.id, "up"))}
          aria-label={`Move ${shortcut.label} up`}
          className="rounded border px-1.5 text-xs hover:bg-gray-50 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          disabled={isReorderPending || isLast}
          onClick={() => startReorderTransition(() => reorderStorefrontShortcut(shortcut.id, "down"))}
          aria-label={`Move ${shortcut.label} down`}
          className="mt-1 rounded border px-1.5 text-xs hover:bg-gray-50 disabled:opacity-30"
        >
          ↓
        </button>
      </div>
      {shortcut.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shortcut.image_url}
          alt={shortcut.label}
          className="max-h-10 max-w-10 shrink-0 object-contain"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gray-100 text-[9px] text-gray-400">
          No image
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{shortcut.label}</div>
        <div className="truncate text-xs text-gray-400">{shortcut.href}</div>
      </div>
      <select
        value={shortcut.badge ?? ""}
        disabled={isBadgePending}
        onChange={(e) => {
          const value = e.target.value as StorefrontShortcutBadge | "";
          startBadgeTransition(() => updateStorefrontShortcutBadge(shortcut.id, value || null));
        }}
        className="rounded border px-2 py-1 text-xs disabled:opacity-50"
      >
        {BADGES.map((b) => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
      </select>
      <form
        action={(fd) => startUploadTransition(() => uploadStorefrontShortcutImage(shortcut.id, fd))}
        className="flex items-center gap-1"
      >
        <input type="file" name="image" accept="image/*" className="w-28 text-xs" />
        <button type="submit" disabled={isUploadPending} className="relative text-xs underline">
          <span className={isUploadPending ? "invisible" : ""}>Upload</span>
          {isUploadPending && <ButtonSpinner className="h-3 w-3" />}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="text-xs underline hover:text-black"
      >
        Edit
      </button>
      <button
        type="button"
        disabled={isRemovePending}
        onClick={() => startRemoveTransition(() => removeStorefrontShortcut(shortcut.id))}
        aria-label={`Remove ${shortcut.label}`}
        className="text-gray-500 hover:text-black disabled:opacity-50"
      >
        ×
      </button>
    </div>
  );
}

export default function ShortcutManager({
  shortcuts,
  products,
  sets,
}: {
  shortcuts: StorefrontShortcut[];
  products: Candidate[];
  sets: CardSet[];
}) {
  const [label, setLabel] = useState("");
  const [linkType, setLinkType] = useState<LinkType>("category");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Candidate | null>(null);
  const [brand, setBrand] = useState("");
  const [setId, setSetId] = useState("");
  const [category, setCategory] = useState("");
  const [keyword, setKeyword] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [badge, setBadge] = useState<StorefrontShortcutBadge | "">("");
  const [isPending, startTransition] = useTransition();

  const trimmedProductSearch = productSearch.trim().toLowerCase();
  const productMatches = trimmedProductSearch
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(trimmedProductSearch) ||
            (p.sku ?? "").toLowerCase().includes(trimmedProductSearch)
        )
        .slice(0, 8)
    : [];

  const setsForBrand = brand ? sets.filter((s) => s.brand === brand) : sets;

  function buildHref(): string | null {
    if (linkType === "product") {
      return selectedProduct ? `/products/${selectedProduct.id}` : null;
    }
    if (linkType === "category") {
      if (!brand && !setId && !category) return null;
      const params = new URLSearchParams();
      if (brand) params.set("brand", brand);
      if (setId) params.set("setId", setId);
      if (category) params.set("category", category);
      return `/?${params.toString()}`;
    }
    if (linkType === "search") {
      const trimmed = keyword.trim();
      return trimmed ? `/?q=${encodeURIComponent(trimmed)}` : null;
    }
    return customUrl.trim() || null;
  }

  const href = buildHref();
  const canSubmit = Boolean(label.trim() && href);

  function resetForm() {
    setLabel("");
    setProductSearch("");
    setSelectedProduct(null);
    setBrand("");
    setSetId("");
    setCategory("");
    setKeyword("");
    setCustomUrl("");
    setBadge("");
  }

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2">
        {shortcuts.map((s, i) => (
          <ShortcutRow
            key={s.id}
            shortcut={s}
            isFirst={i === 0}
            isLast={i === shortcuts.length - 1}
          />
        ))}
        {shortcuts.length === 0 && <span className="text-sm text-gray-400">No shortcuts yet</span>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!href || !label.trim()) return;
          startTransition(() => addStorefrontShortcut(label, href, badge || null));
          resetForm();
        }}
        className="flex flex-col gap-3 rounded border p-3"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. New Arrivals"
            className="rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Badge</label>
          <div className="flex gap-2">
            {BADGES.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => setBadge(b.value)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  badge === b.value ? "bg-black text-white" : "hover:bg-gray-50"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {(["category", "product", "search", "custom"] as LinkType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setLinkType(t)}
              className={`rounded-full border px-3 py-1 text-xs capitalize ${
                linkType === t ? "bg-black text-white" : "hover:bg-gray-50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {linkType === "product" && (
          <div className="relative">
            <input
              type="text"
              value={selectedProduct ? selectedProduct.name : productSearch}
              onChange={(e) => {
                setSelectedProduct(null);
                setProductSearch(e.target.value);
              }}
              placeholder="Search products…"
              className="w-full rounded border px-3 py-2 text-sm"
            />
            {productSearch && !selectedProduct && productMatches.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded border bg-white shadow">
                {productMatches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProduct(p);
                      setProductSearch("");
                    }}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    <span>{p.name}</span>
                    {p.sku && <span className="text-xs text-gray-400">{p.sku}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {linkType === "category" && (
          <div className="flex flex-wrap gap-2">
            <select
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setSetId("");
              }}
              className="rounded border px-2 py-2 text-sm"
            >
              <option value="">All brands</option>
              {PRODUCT_BRANDS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
            <select
              value={setId}
              onChange={(e) => setSetId(e.target.value)}
              className="rounded border px-2 py-2 text-sm"
            >
              <option value="">All sets</option>
              {setsForBrand.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded border px-2 py-2 text-sm"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {linkType === "search" && (
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search keyword…"
            className="rounded border px-3 py-2 text-sm"
          />
        )}

        {linkType === "custom" && (
          <input
            type="text"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="/products/... or https://..."
            className="rounded border px-3 py-2 text-sm"
          />
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isPending || !canSubmit}
            className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Add shortcut
          </button>
          {href && <span className="truncate text-xs text-gray-400">{href}</span>}
        </div>
      </form>
    </div>
  );
}
