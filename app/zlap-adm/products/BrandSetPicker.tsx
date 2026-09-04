"use client";

import { useEffect, useRef, useState } from "react";
import { PRODUCT_BRANDS, CARD_SET_LANGUAGES } from "@/lib/constants";
import type { CardSet } from "@/lib/types";

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

export default function BrandSetPicker({
  sets,
  initialBrand,
  initialSetId,
}: {
  sets: CardSet[];
  initialBrand?: string | null;
  initialSetId?: string | null;
}) {
  const [brand, setBrand] = useState(initialBrand ?? "");
  const [brandSearch, setBrandSearch] = useState(
    () => PRODUCT_BRANDS.find((b) => b.value === initialBrand)?.label ?? ""
  );
  const [isBrandOpen, setIsBrandOpen] = useState(false);
  const brandRef = useClickOutside(() => setIsBrandOpen(false));

  const [setId, setSetId] = useState(initialSetId ?? "");
  const [search, setSearch] = useState(
    () => sets.find((s) => s.id === initialSetId)?.name ?? ""
  );
  const [isOpen, setIsOpen] = useState(false);
  const setRef = useClickOutside(() => setIsOpen(false));

  function selectBrand(b: (typeof PRODUCT_BRANDS)[number]) {
    setBrand(b.value);
    setBrandSearch(b.label);
    setIsBrandOpen(false);
    setSetId("");
    setSearch("");
  }

  function selectSet(s: CardSet) {
    setSetId(s.id);
    setSearch(s.name);
    setIsOpen(false);
  }

  const brandMatches = PRODUCT_BRANDS.filter((b) =>
    b.label.toLowerCase().includes(brandSearch.toLowerCase())
  );
  const setsForBrand = sets.filter((s) => s.brand === brand);
  const setMatches = setsForBrand.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="flex flex-col gap-1" ref={brandRef}>
        <label htmlFor="brand_search" className="text-sm font-medium">
          Brand
        </label>
        <div className="relative">
          <input
            id="brand_search"
            type="text"
            value={brandSearch}
            onFocus={() => setIsBrandOpen(true)}
            onChange={(e) => {
              setBrandSearch(e.target.value);
              setBrand("");
              setSetId("");
              setSearch("");
              setIsBrandOpen(true);
            }}
            placeholder="Search brands…"
            autoComplete="off"
            className="w-full rounded border px-3 py-2"
          />
          <input type="hidden" name="brand" value={brand} />
          {isBrandOpen && (
            <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded border bg-white shadow">
              {brandMatches.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => selectBrand(b)}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
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
      </div>
      <div className="flex flex-col gap-1" ref={setRef}>
        <label htmlFor="set_search" className="text-sm font-medium">
          Set
        </label>
        <div className="relative">
          <input
            id="set_search"
            type="text"
            value={search}
            disabled={!brand}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setSearch(e.target.value);
              setSetId("");
              setIsOpen(true);
            }}
            placeholder={brand ? "Search sets…" : "Select a brand first"}
            autoComplete="off"
            className="w-full rounded border px-3 py-2 disabled:bg-gray-50"
          />
          <input type="hidden" name="set_id" value={setId} />
          {isOpen && brand && (
            <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded border bg-white shadow">
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
                        onClick={() => selectSet(s)}
                        className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
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
      </div>
    </>
  );
}
