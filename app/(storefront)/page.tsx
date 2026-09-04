"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { copy } from "@/lib/copy";
import ButtonSpinner from "@/app/ButtonSpinner";
import PageSpinner from "@/app/PageSpinner";
import ProductCard from "./ProductCard";
import FeaturedCarousel from "./FeaturedCarousel";
import CategoryShortcuts from "./CategoryShortcuts";
import FilterToolbar, { type StorefrontFilterValue } from "./FilterToolbar";

const EMPTY_FILTERS: StorefrontFilterValue = { brand: "", setId: "", category: "" };

function StorePageContent() {
  // Reflects the real URL query string, kept in sync by Next across
  // navigations — unlike reading window.location.search once, this also
  // updates when a <Link> (footer, product card, a saved shortcut) points at
  // "/?category=..." while the homepage is already mounted: since that's the
  // same route, React doesn't remount this component, so a one-time-on-mount
  // read of the URL would otherwise keep showing whatever was last searched.
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [results, setResults] = useState<StorefrontProduct[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [section1, setSection1] = useState<StorefrontProduct[]>([]);
  const [section2, setSection2] = useState<StorefrontProduct[]>([]);
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(true);
  const [sectionTitles, setSectionTitles] = useState({
    featured_section_1: "Section 1",
    featured_section_2: "Section 2",
  });
  const [popularKeywords, setPopularKeywords] = useState<string[]>([]);
  const [shortcuts, setShortcuts] = useState<StorefrontShortcut[]>([]);
  const [sets, setSets] = useState<CardSet[]>([]);
  const [filters, setFilters] = useState<StorefrontFilterValue>(() => ({
    brand: searchParams.get("brand") ?? "",
    setId: searchParams.get("setId") ?? "",
    category: searchParams.get("category") ?? "",
  }));
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

  // Page data that doesn't depend on the URL query string — fetched once.
  useEffect(() => {
    Promise.all([
      getFeaturedProducts("featured_section_1").then(setSection1),
      getFeaturedProducts("featured_section_2").then(setSection2),
    ]).finally(() => setIsLoadingFeatured(false));
    getStorefrontSectionTitles().then(setSectionTitles);
    getPopularKeywords().then(setPopularKeywords);
    getStorefrontShortcuts().then(setShortcuts);
    getCardSetsInStock().then(setSets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-derive query/filters from the URL on mount, and again whenever it
  // changes via a real Next navigation. Our own in-page interactions
  // (typing, clicking a shortcut chip below) update the URL directly via
  // history.replaceState instead of the router, which doesn't change what
  // useSearchParams() sees — so they manage their own state and don't
  // fight with this effect.
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const next: StorefrontFilterValue = {
      brand: searchParams.get("brand") ?? "",
      setId: searchParams.get("setId") ?? "",
      category: searchParams.get("category") ?? "",
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local state from the URL is the point of this effect
    setQuery(q);
    setFilters(next);
    setFilterSyncToken((t) => t + 1);
    if (q.trim() || next.brand || next.setId || next.category) {
      runSearch(q, next);
    } else {
      setResults(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    const url = trimmed ? `/?q=${encodeURIComponent(trimmed)}` : "/";
    window.history.replaceState(null, "", url);
    runSearch(trimmed, filters);
  };

  const handleKeywordClick = (keyword: string) => {
    setQuery(keyword);
    setFilters(EMPTY_FILTERS);
    setFilterSyncToken((t) => t + 1);
    window.history.replaceState(null, "", `/?q=${encodeURIComponent(keyword)}`);
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

  // A homepage shortcut whose href is a /?... filter/search link — parse
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
    window.history.replaceState(null, "", `/?${params.toString()}`);
    runSearch(q, next);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <form onSubmit={handleSubmit} className="relative">
        <button
          type="submit"
          disabled={isSearching}
          aria-label={copy.home.searchAria}
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
          placeholder={copy.home.searchPlaceholder}
          className="w-full rounded bg-[#efefef] py-3 pr-10 pl-11 text-base"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              window.history.replaceState(null, "", "/");
              runSearch("", filters);
            }}
            aria-label={copy.home.clearSearchAria}
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
          {isLoadingFeatured ? (
            <PageSpinner label={copy.home.loadingProducts} />
          ) : (
            <>
              <FeaturedCarousel title={sectionTitles.featured_section_1} products={section1} />
              <FeaturedCarousel title={sectionTitles.featured_section_2} products={section2} />
            </>
          )}
        </>
      ) : isSearching ? (
        <PageSpinner label={copy.home.searching} />
      ) : results.length === 0 ? (
        <p className="text-sm text-gray-500">{copy.home.noProducts}</p>
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

export default function StorePage() {
  return (
    <Suspense fallback={<PageSpinner label={copy.home.loadingProducts} />}>
      <StorePageContent />
    </Suspense>
  );
}
