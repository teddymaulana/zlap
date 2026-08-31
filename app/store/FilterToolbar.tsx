"use client";

import { useEffect, useRef, useState } from "react";
import { PRODUCT_BRANDS, CARD_SET_LANGUAGES } from "@/lib/constants";
import type { CardSet } from "@/lib/types";
import type { StorefrontCategory } from "@/app/actions/storefront";

const CATEGORIES: { value: StorefrontCategory; label: string }[] = [
  { value: "booster_boxes", label: "Booster Boxes" },
  { value: "singles", label: "Singles" },
  { value: "slabs", label: "Slabs" },
  { value: "other", label: "Other" },
];

export type StorefrontFilterValue = {
  brand: string;
  setId: string;
  category: string;
};

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onOutside]);
  return ref;
}

export default function FilterToolbar({
  sets,
  value,
  onChange,
  syncToken,
}: {
  sets: CardSet[];
  value: StorefrontFilterValue;
  onChange: (next: StorefrontFilterValue) => void;
  /** Bump this (e.g. a counter) whenever `value` is set from outside this component. */
  syncToken?: number;
}) {
  const [brandSearch, setBrandSearch] = useState(
    () => PRODUCT_BRANDS.find((b) => b.value === value.brand)?.label ?? ""
  );
  const [isBrandOpen, setIsBrandOpen] = useState(false);
  const brandRef = useClickOutside(() => setIsBrandOpen(false));

  const [setSearch, setSetSearch] = useState(
    () => sets.find((s) => s.id === value.setId)?.name ?? ""
  );
  const [isSetOpen, setIsSetOpen] = useState(false);
  const setRef = useClickOutside(() => setIsSetOpen(false));

  const [categorySearch, setCategorySearch] = useState(
    () => CATEGORIES.find((c) => c.value === value.category)?.label ?? ""
  );
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const categoryRef = useClickOutside(() => setIsCategoryOpen(false));

  // syncToken bumps only when a filter is set from outside this component
  // (e.g. a homepage category shortcut) — re-derive the display text then.
  // It must NOT re-run on every value.brand/setId/category change, since typing
  // in these boxes also clears the active filter and would otherwise wipe
  // what the user is mid-typing.
  useEffect(() => {
    if (syncToken === undefined) return;
    setBrandSearch(PRODUCT_BRANDS.find((b) => b.value === value.brand)?.label ?? "");
    setSetSearch(sets.find((s) => s.id === value.setId)?.name ?? "");
    setCategorySearch(CATEGORIES.find((c) => c.value === value.category)?.label ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncToken]);

  const brandMatches = PRODUCT_BRANDS.filter((b) =>
    b.label.toLowerCase().includes(brandSearch.toLowerCase())
  );
  const setsForBrand = value.brand ? sets.filter((s) => s.brand === value.brand) : sets;
  const setMatches = setsForBrand.filter((s) =>
    s.name.toLowerCase().includes(setSearch.toLowerCase())
  );
  const categoryMatches = CATEGORIES.filter((c) =>
    c.label.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const hasActiveFilters = Boolean(value.brand || value.setId || value.category);

  const inputClass = "w-28 rounded bg-[#efefef] px-2 py-1 text-xs sm:w-40";
  const dropdownClass = "absolute z-10 mt-1 max-h-64 w-56 overflow-y-auto rounded border bg-white shadow";
  const optionClass = "block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50";

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <div className="relative" ref={brandRef}>
        <input
          type="text"
          value={brandSearch}
          onFocus={() => {
            setIsBrandOpen(true);
            if (value.brand) {
              setBrandSearch("");
              onChange({ ...value, brand: "", setId: "" });
            }
          }}
          onChange={(e) => {
            setBrandSearch(e.target.value);
            setIsBrandOpen(true);
            if (value.brand) onChange({ ...value, brand: "", setId: "" });
          }}
          placeholder="All Brands"
          autoComplete="off"
          className={inputClass}
        />
        {isBrandOpen && (
          <div className={dropdownClass}>
            {brandMatches.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => {
                  setBrandSearch(b.label);
                  setIsBrandOpen(false);
                  setSetSearch("");
                  onChange({ ...value, brand: b.value, setId: "" });
                }}
                className={optionClass}
              >
                {b.label}
              </button>
            ))}
            {brandMatches.length === 0 && (
              <div className="px-3 py-1.5 text-sm text-gray-400">No brands found</div>
            )}
          </div>
        )}
      </div>

      <div className="relative" ref={setRef}>
        <input
          type="text"
          value={setSearch}
          onFocus={() => {
            setIsSetOpen(true);
            if (value.setId) {
              setSetSearch("");
              onChange({ ...value, setId: "" });
            }
          }}
          onChange={(e) => {
            setSetSearch(e.target.value);
            setIsSetOpen(true);
            if (value.setId) onChange({ ...value, setId: "" });
          }}
          placeholder="All Sets"
          autoComplete="off"
          className={inputClass}
        />
        {isSetOpen && (
          <div className={dropdownClass}>
            {CARD_SET_LANGUAGES.map((lang) => {
              const options = setMatches.filter((s) => s.language === lang.value);
              if (options.length === 0) return null;
              return (
                <div key={lang.value}>
                  <div className="bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500">
                    {lang.label}
                  </div>
                  {options.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSetSearch(s.name);
                        setIsSetOpen(false);
                        if (!value.brand) setBrandSearch(PRODUCT_BRANDS.find((b) => b.value === s.brand)?.label ?? "");
                        onChange({ ...value, setId: s.id, brand: value.brand || s.brand });
                      }}
                      className={optionClass}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              );
            })}
            {setMatches.length === 0 && (
              <div className="px-3 py-1.5 text-sm text-gray-400">No sets found</div>
            )}
          </div>
        )}
      </div>

      <div className="relative" ref={categoryRef}>
        <input
          type="text"
          value={categorySearch}
          onFocus={() => {
            setIsCategoryOpen(true);
            if (value.category) {
              setCategorySearch("");
              onChange({ ...value, category: "" });
            }
          }}
          onChange={(e) => {
            setCategorySearch(e.target.value);
            setIsCategoryOpen(true);
            if (value.category) onChange({ ...value, category: "" });
          }}
          placeholder="All Categories"
          autoComplete="off"
          className={inputClass}
        />
        {isCategoryOpen && (
          <div className={dropdownClass}>
            {categoryMatches.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  setCategorySearch(c.label);
                  setIsCategoryOpen(false);
                  onChange({ ...value, category: c.value });
                }}
                className={optionClass}
              >
                {c.label}
              </button>
            ))}
            {categoryMatches.length === 0 && (
              <div className="px-3 py-1.5 text-sm text-gray-400">No categories found</div>
            )}
          </div>
        )}
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => {
            setBrandSearch("");
            setSetSearch("");
            setCategorySearch("");
            onChange({ brand: "", setId: "", category: "" });
          }}
          className="text-sm text-gray-500 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
