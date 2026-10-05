import { Suspense } from "react";
import {
  getFeaturedProducts,
  getStorefrontSectionTitles,
  getPopularKeywords,
  getStorefrontShortcuts,
  type StorefrontProduct,
} from "@/app/actions/storefront";
import { getCardSetsInStock } from "@/app/actions/sets";
import { copy } from "@/lib/copy";
import ZlapLoader from "@/app/ZlapLoader";
import HomeContent from "./HomeContent";

// Homepage data is fetched here on the server, all at once, rather than by
// HomeContent calling each server action after hydration — the browser runs
// server actions one at a time, so the shortcuts used to wait behind both
// featured sections. Each fetch falls back to empty on failure, same as the
// old client-side calls that just left their section blank.
export default async function StorePage() {
  // Not awaited — streamed to HomeContent so the heavier featured sections
  // don't hold back the search bar and shortcuts.
  const featured: Promise<[StorefrontProduct[], StorefrontProduct[]]> = Promise.all([
    getFeaturedProducts("featured_section_1"),
    getFeaturedProducts("featured_section_2"),
  ]).catch((err) => {
    console.error("Failed to load featured products:", err);
    return [[], []];
  });

  const [sectionTitles, popularKeywords, shortcuts, sets] = await Promise.all([
    getStorefrontSectionTitles().catch(() => ({ featured_section_1: "Section 1", featured_section_2: "Section 2" })),
    getPopularKeywords().catch(() => []),
    getStorefrontShortcuts().catch(() => []),
    getCardSetsInStock().catch(() => []),
  ]);

  return (
    <Suspense fallback={<ZlapLoader label={copy.home.loadingProducts} />}>
      <HomeContent initial={{ sectionTitles, popularKeywords, shortcuts, sets }} featured={featured} />
    </Suspense>
  );
}
