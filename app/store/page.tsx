"use client";

import { useEffect, useState } from "react";
import {
  searchStorefrontProducts,
  getFeaturedProducts,
  getStorefrontSectionTitles,
  getPopularKeywords,
  type StorefrontProduct,
} from "@/app/actions/storefront";
import { getCardSets } from "@/app/actions/sets";
import type { CardSet } from "@/lib/types";
import ButtonSpinner from "@/app/ButtonSpinner";
import ProductCard from "./ProductCard";
import FeaturedCarousel from "./FeaturedCarousel";
import FilterToolbar, { type StorefrontFilterValue } from "./FilterToolbar";

const EMPTY_FILTERS: StorefrontFilterValue = { brand: "", setId: "", category: "" };

// Pick up ?q= from the URL on first load (e.g. a shared/bookmarked search link).
function initialQuery() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
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
  const [sets, setSets] = useState<CardSet[]>([]);
  const [filters, setFilters] = useState<StorefrontFilterValue>(EMPTY_FILTERS);

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
    if (query) runSearch(query, EMPTY_FILTERS);
    getFeaturedProducts("featured_section_1").then(setSection1);
    getFeaturedProducts("featured_section_2").then(setSection2);
    getStorefrontSectionTitles().then(setSectionTitles);
    getPopularKeywords().then(setPopularKeywords);
    getCardSets().then(setSets);
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
    window.history.replaceState(null, "", `/store?q=${encodeURIComponent(keyword)}`);
    runSearch(keyword, filters);
  };

  const handleFiltersChange = (next: StorefrontFilterValue) => {
    setFilters(next);
    runSearch(query, next);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded bg-[#efefef] px-4 py-3 pr-10 text-base"
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
        </div>
        <button
          type="submit"
          disabled={isSearching}
          className="relative rounded bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          <span className={isSearching ? "invisible" : ""}>Search</span>
          {isSearching && <ButtonSpinner />}
        </button>
      </form>

      <div className="mt-3">
        <FilterToolbar sets={sets} value={filters} onChange={handleFiltersChange} />
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
