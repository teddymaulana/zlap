"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  searchStorefrontProducts,
  type StorefrontProduct,
  type StorefrontSearchResult,
} from "@/app/actions/storefront";
import type { CardSet, StorefrontShortcut } from "@/lib/types";
import { copy } from "@/lib/copy";
import ButtonSpinner from "@/app/ButtonSpinner";
import ZlapLoader from "@/app/ZlapLoader";
import ProductCard from "./ProductCard";
import FeaturedCarousel from "./FeaturedCarousel";
import CategoryShortcuts from "./CategoryShortcuts";
import FilterToolbar, { type StorefrontFilterValue } from "./FilterToolbar";
import ShopBySetCTAs from "./ShopBySetCTAs";
import SearchPagination from "./SearchPagination";

const EMPTY_FILTERS: StorefrontFilterValue = { brand: "", setId: "", category: "" };

export type HomeInitialData = {
  sectionTitles: { featured_section_1: string; featured_section_2: string };
  popularKeywords: string[];
  shortcuts: StorefrontShortcut[];
  sets: CardSet[];
};

// Streamed in from the server (app/(storefront)/page.tsx) — the heaviest
// homepage query, so it resolves behind its own Suspense boundary instead of
// holding back the search bar and shortcuts above it.
function FeaturedSections({
  featured,
  titles,
}: {
  featured: Promise<[StorefrontProduct[], StorefrontProduct[]]>;
  titles: HomeInitialData["sectionTitles"];
}) {
  const [section1, section2] = use(featured);
  return (
    <>
      <FeaturedCarousel title={titles.featured_section_1} products={section1} />
      <FeaturedCarousel title={titles.featured_section_2} products={section2} />
      <Image
        src="/free-gift-banner-mobile.png"
        alt="Free gift with purchase"
        width={390}
        height={200}
        className="mb-8 h-auto w-full rounded sm:hidden"
      />
      <Image
        src="/free-gift-banner.png"
        alt="Free gift with purchase"
        width={1600}
        height={260}
        className="mb-8 hidden h-auto w-full rounded sm:block"
      />
    </>
  );
}

export default function HomeContent({
  initial,
  featured,
}: {
  initial: HomeInitialData;
  featured: Promise<[StorefrontProduct[], StorefrontProduct[]]>;
}) {
  // Reflects the real URL query string, kept in sync by Next across
  // navigations — unlike reading window.location.search once, this also
  // updates when a <Link> (footer, product card, a saved shortcut) points at
  // "/?category=..." while the homepage is already mounted: since that's the
  // same route, React doesn't remount this component, so a one-time-on-mount
  // read of the URL would otherwise keep showing whatever was last searched.
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [results, setResults] = useState<StorefrontSearchResult | null>(null);
  // The query `results` were fetched for — `query` tracks the input as it's
  // typed, before the search actually runs.
  const [resultsQuery, setResultsQuery] = useState("");
  // Lazy-initialized from the URL so a direct load of "/?q=..." renders the
  // searching state on the very first paint — the mount effect below that
  // actually runs the search fires after that paint, so without this, the
  // homepage content flashes first (results is still null) until it resolves.
  const [isSearching, setIsSearching] = useState(
    () =>
      Boolean(searchParams.get("q")?.trim()) ||
      Boolean(searchParams.get("brand")) ||
      Boolean(searchParams.get("setId")) ||
      Boolean(searchParams.get("category")) ||
      searchParams.get("all") === "1"
  );
  const { sectionTitles, popularKeywords, shortcuts, sets } = initial;
  const [filters, setFilters] = useState<StorefrontFilterValue>(() => ({
    brand: searchParams.get("brand") ?? "",
    setId: searchParams.get("setId") ?? "",
    category: searchParams.get("category") ?? "",
  }));
  const [filterSyncToken, setFilterSyncToken] = useState(0);
  // "Shop all" mode (/?all=1) — lists every product even with no query or
  // filter set. Cleared by starting a new keyword search or shortcut.
  const [showAll, setShowAll] = useState(() => searchParams.get("all") === "1");
  // Last keyword sent as a "Search" event — paging or changing filters on the
  // same keyword re-runs the search but shouldn't count as a new search.
  const lastTrackedKeyword = useRef<string | null>(null);

  const runSearch = async (q: string, f: StorefrontFilterValue, page = 1, all = showAll) => {
    const trimmed = q.trim();
    if (!trimmed && !f.brand && !f.setId && !f.category && !all) {
      setResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const res = await searchStorefrontProducts(
        trimmed,
        {
          brand: (f.brand || undefined) as "pokemon" | "one_piece" | undefined,
          setId: f.setId || undefined,
          category: (f.category || undefined) as
            | "booster_boxes"
            | "singles"
            | "slabs"
            | "other"
            | undefined,
          all,
        },
        page
      );
      setResults(res);
      setResultsQuery(trimmed);
      if (trimmed && trimmed.toLowerCase() !== lastTrackedKeyword.current) {
        lastTrackedKeyword.current = trimmed.toLowerCase();
        trackEvent(
          "Search",
          { keyword: trimmed.toLowerCase(), results: res.total },
          { event: "search", params: { search_term: trimmed.toLowerCase(), results: res.total } }
        );
      }
    } finally {
      setIsSearching(false);
    }
  };

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
    const all = searchParams.get("all") === "1";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local state from the URL is the point of this effect
    setQuery(q);
    setFilters(next);
    setFilterSyncToken((t) => t + 1);
    setShowAll(all);
    if (q.trim() || next.brand || next.setId || next.category || all) {
      runSearch(q, next, Number(searchParams.get("page")) || 1, all);
    } else {
      setResults(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Submitting via Enter leaves the input focused, which keeps the mobile
    // on-screen keyboard open even though the search has already run.
    (document.activeElement as HTMLElement | null)?.blur();
    const trimmed = query.trim();
    const url = trimmed ? `/?q=${encodeURIComponent(trimmed)}` : "/";
    window.history.replaceState(null, "", url);
    setShowAll(false);
    runSearch(trimmed, filters, 1, false);
  };

  const handleKeywordClick = (keyword: string) => {
    setQuery(keyword);
    setFilters(EMPTY_FILTERS);
    setFilterSyncToken((t) => t + 1);
    window.history.replaceState(null, "", `/?q=${encodeURIComponent(keyword)}`);
    setShowAll(false);
    runSearch(keyword, EMPTY_FILTERS, 1, false);
  };

  // "View all products" from the no-results message — drops the query and
  // filters and switches to shop-all mode in place.
  const handleShowAll = () => {
    setQuery("");
    setFilters(EMPTY_FILTERS);
    setFilterSyncToken((t) => t + 1);
    setShowAll(true);
    window.history.replaceState(null, "", "/?all=1");
    runSearch("", EMPTY_FILTERS, 1, true);
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

  // Keeps the current query/filters in the URL and just swaps the page
  // param (dropped for page 1), so a reload or shared link lands on the
  // same page of results.
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(window.location.search);
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/?${qs}` : "/");
    window.scrollTo({ top: 0, behavior: "smooth" });
    runSearch(query, filters, page);
  };

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
    setShowAll(false);
    runSearch(q, next, 1, false);
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
          className="w-full rounded bg-[#efefef] py-3 pr-10 pl-11 text-base outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              window.history.replaceState(null, "", showAll ? "/?all=1" : "/");
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

      {isSearching ? (
        <ZlapLoader label={copy.home.searching} />
      ) : results === null ? (
        <>
          <Link href="/?all=1" aria-label={copy.header.shopAll} className="mb-8 block">
            <Image
              src="/zcb-hero-banner-mobile.webp"
              alt="Zlap Card"
              width={390}
              height={200}
              priority
              className="h-auto w-full rounded sm:hidden"
            />
            <Image
              src="/zcb-hero-banner.webp"
              alt="Zlap Card"
              width={3200}
              height={360}
              priority
              className="hidden h-auto w-full rounded sm:block"
            />
          </Link>
          <ShopBySetCTAs />
          <Suspense fallback={<ZlapLoader label={copy.home.loadingProducts} />}>
            <FeaturedSections featured={featured} titles={sectionTitles} />
          </Suspense>
        </>
      ) : results.products.length === 0 ? (
        <div className="text-sm text-gray-500">
          <p>{copy.home.noProducts}</p>
          {!(showAll && !resultsQuery && !filters.brand && !filters.setId && !filters.category) && (
            <button
              type="button"
              onClick={handleShowAll}
              className="mt-2 font-medium text-black underline"
            >
              {copy.home.viewAllProducts}
            </button>
          )}
        </div>
      ) : (
        <>
          {resultsQuery.toLowerCase() === "graded" && (
            <>
              <Image
                src="/graded-page-mob.png"
                alt="Graded PSA slabs, more graded cards coming"
                width={683}
                height={333}
                priority
                className="mb-6 h-auto w-full rounded sm:hidden"
              />
              <Image
                src="/graded-page.png"
                alt="Graded PSA slabs, more graded cards coming"
                width={2000}
                height={275}
                priority
                className="mb-6 hidden h-auto w-full rounded sm:block"
              />
            </>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {results.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <SearchPagination
            page={results.page}
            pageSize={results.pageSize}
            total={results.total}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}
