"use client";

import { useEffect, useRef, useState } from "react";
import { searchShippingArea, type ShippingArea } from "@/app/actions/shipping";

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

export default function AreaAutocomplete({
  value,
  onChange,
}: {
  value: string;
  onChange: (areaName: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<ShippingArea[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const ref = useClickOutside(() => setIsOpen(false));

  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(() => {
      if (trimmed.length < 3 || trimmed === value) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      searchShippingArea(trimmed).then((areas) => {
        setResults(areas);
        setIsSearching(false);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [query, value]);

  function select(area: ShippingArea) {
    setQuery(area.name);
    onChange(area.name);
    setIsOpen(false);
    setResults([]);
  }

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange("");
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="City / district / postal code"
        autoComplete="off"
        required
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
      />
      {isOpen && (isSearching || results.length > 0) && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow">
          {isSearching ? (
            <div className="px-3 py-2 text-sm text-gray-400">Searching…</div>
          ) : (
            results.map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => select(area)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                {area.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
