"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  searchStorefrontProducts,
  getFeaturedProducts,
  getStorefrontSectionTitles,
  getPopularKeywords,
  getStorefrontShortcuts,
  type StorefrontProduct,
} from "@/app/actions/storefront";
import { getCardSetsInStock } from "@/app/actions/sets";
import type { CardSet, StorefrontShortcut } from "@/lib/types";
import ButtonSpinner from "@/app/ButtonSpinner";
import ProductCard from "./ProductCard";
import FeaturedCarousel from "./FeaturedCarousel";
import CategoryShortcuts from "./CategoryShortcuts";
import FilterToolbar, { type StorefrontFilterValue } from "./FilterToolbar";

const EMPTY_FILTERS: StorefrontFilterValue = { brand: "", setId: "", category: "" };

// Pick up ?q= from the URL on first load (e.g. a shared/bookmarked search link).
function initialQuery() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

// Pick up ?brand=/?setId=/?category= from the URL on first load — e.g. a
// shared/bookmarked link to a category-filter homepage shortcut.
function initialFilters(): StorefrontFilterValue {
  if (typeof window === "undefined") return EMPTY_FILTERS;
  const params = new URLSearchParams(window.location.search);
  return {
    brand: params.get("brand") ?? "",
    setId: params.get("setId") ?? "",
    category: params.get("category") ?? "",
  };
}

export default function StorePage() {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<StorefrontProduct[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [section1, setSection1] = useState<StorefrontProduct[]>([]);
  const [section2, setSection2] = useState<StorefrontProduct[]>([]);
  const [sectionTitles, setSectionTitles] = useState({
    featured_section_1: "Section 1",
    featured_section_2: "Section 2",
  });
  const [popularKeywords, setPopularKeywords] = useState<string[]>([]);
  const [shortcuts, setShortcuts] = useState<StorefrontShortcut[]>([]);
  const [sets, setSets] = useState<CardSet[]>([]);
  const [filters, setFilters] = useState<StorefrontFilterValue>(initialFilters);
  const [filterSyncToken, setFilterSyncToken] = useState(0);

  const runSearch = async (q: string, f: StorefrontFilterValue) => {
    const trimmed = q.trim();
    if (!trimmed && !f.brand && !f.setId && !f.category) {
      setResults(null);
      return;
    }
    setIsSearching(true);
    try {
      setResults(
        await searchStorefrontProducts(trimmed, {
          brand: (f.brand || undefined) as "pokemon" | "one_piece" | undefined,
          setId: f.setId || undefined,
          category: (f.category || undefined) as
            | "booster_boxes"
            | "singles"
            | "slabs"
            | "other"
            | undefined,
        })
      );
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial search from the URL, runs once
    if (query || filters.brand || filters.setId || filters.category) runSearch(query, filters);
    getFeaturedProducts("featured_section_1").then(setSection1);
    getFeaturedProducts("featured_section_2").then(setSection2);
    getStorefrontSectionTitles().then(setSectionTitles);
    getPopularKeywords().then(setPopularKeywords);
    getStorefrontShortcuts().then(setShortcuts);
    getCardSetsInStock().then(setSets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    const url = trimmed ? `/store?q=${encodeURIComponent(trimmed)}` : "/store";
    window.history.replaceState(null, "", url);
    runSearch(trimmed, filters);
  };

  const handleKeywordClick = (keyword: string) => {
    setQuery(keyword);
    setFilters(EMPTY_FILTERS);
    setFilterSyncToken((t) => t + 1);
    window.history.replaceState(null, "", `/store?q=${encodeURIComponent(keyword)}`);
    runSearch(keyword, EMPTY_FILTERS);
  };

  // Canonical query string for the currently applied query/filters, built the
  // same way ShortcutManager builds a shortcut's href — so it can be compared
  // directly against a shortcut's own params to tell which one (if any) is
  // currently active. Includes the live search text even when filters are
  // also set, so typing a query clears the highlight immediately instead of
  // leaving a category shortcut looking active while you search within it.
  const activeSearch = (() => {
    const params = new URLSearchParams();
    if (filters.brand) params.set("brand", filters.brand);
    if (filters.setId) params.set("setId", filters.setId);
    if (filters.category) params.set("category", filters.category);
    if (query.trim()) params.set("q", query.trim());
    return params.toString();
  })();

  const handleFiltersChange = (next: StorefrontFilterValue) => {
    setFilters(next);
    runSearch(query, next);
  };

  // A homepage shortcut whose href is a /store?... filter/search link — parse
  // the query string it encodes and apply it in place, no full page reload.
  const handleShortcutFilter = (params: URLSearchParams) => {
    const q = params.get("q") ?? "";
    const next: StorefrontFilterValue = {
      brand: params.get("brand") ?? "",
      setId: params.get("setId") ?? "",
      category: params.get("category") ?? "",
    };
    setQuery(q);
    setFilters(next);
    setFilterSyncToken((t) => t + 1);
    window.history.replaceState(null, "", `/store?${params.toString()}`);
    runSearch(q, next);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <form onSubmit={handleSubmit} className="relative">
        <button
          type="submit"
          disabled={isSearching}
          aria-label="Search"
          className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-500 hover:text-black disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-5 w-5 ${isSearching ? "invisible" : ""}`}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          {isSearching && <ButtonSpinner />}
        </button>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="w-full rounded bg-[#efefef] py-3 pr-10 pl-11 text-base"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              window.history.replaceState(null, "", "/store");
              runSearch("", filters);
            }}
            aria-label="Clear search"
            className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </form>

      <div className="mt-5">
        <CategoryShortcuts
          shortcuts={shortcuts}
          onFilterShortcut={handleShortcutFilter}
          activeSearch={activeSearch}
        />
      </div>

      <div className="mt-3">
        <FilterToolbar
          sets={sets}
          value={filters}
          onChange={handleFiltersChange}
          syncToken={filterSyncToken}
        />
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-1.5">
        {popularKeywords.map((keyword) => (
          <button
            key={keyword}
            type="button"
            onClick={() => handleKeywordClick(keyword)}
            className="rounded-full border px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50"
          >
            {keyword}
          </button>
        ))}
      </div>

      {results === null ? (
        <>
          <Image
            src="/zlap-card-hero-banner.png"
            alt="Zlap Card"
            width={3200}
            height={360}
            priority
            className="mb-8 h-auto w-full rounded"
          />
          <FeaturedCarousel title={sectionTitles.featured_section_1} products={section1} />
          <FeaturedCarousel title={sectionTitles.featured_section_2} products={section2} />
        </>
      ) : isSearching ? (
        <p className="text-sm text-gray-500">Searching…</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-gray-500">No products found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
