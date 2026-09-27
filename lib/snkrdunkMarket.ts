// Server-only SNKRDUNK market lookups — deliberately NOT a "use server"
// module, so none of this is a publicly callable endpoint by itself. Used by
// the admin PSA 10 reference (app/actions/snkrdunk.ts), pre-order pricing
// (lib/preorderPricing.ts), and the daily pre-order price refresh.
import { unstable_cache } from "next/cache";

// PSA 10 market figures for a card, read from SNKRDUNK's used-listings
// data — the same undocumented internal endpoint their own listings page
// calls (SNKRDUNK has no public API). Feeds the admin reference and the
// pre-order price snapshot; SNKRDUNK is never named or called from the
// storefront, which only reads the saved, marked-up products.po_price.
//
// Kept deliberately low-volume: fetched only from admin actions and the
// once-a-day pre-order refresh, and cached per card for a day. Being
// undocumented, the endpoint can change or start refusing requests at any
// time — callers get an error back (never cached) and staff fall back to
// opening the SNKRDUNK link by hand.

// PSA 10's conditionId on SNKRDUNK, from the grade → id map their listings
// page embeds (`all-conditions-map`): PSA10 = 22, PSA9 = 23, ARS10 = 30, …
const PSA10_CONDITION_ID = 22;
// A listing with status 0 is still for sale ("出品中/入札中"); every other
// status is a sale somewhere in fulfilment (awaiting grading check, in
// transit, completed), so it counts as sold. There's no reliable sale
// time: updatedAt moves with each fulfilment step, so a "completed" sale
// carries a date one to two weeks after it actually sold. Recency is taken
// from the listing order instead (newest listings first).
const FOR_SALE_STATUS = 0;
const RECENT_SOLD_SAMPLE = 10;
const CACHE_SECONDS = 24 * 60 * 60;

export type Psa10Reference = {
  apparelId: string;
  cardName: string | null;
  lowestAskJpy: number | null;
  // Across the most recently listed PSA 10 copies that have sold — the
  // median, so a single outlier sale doesn't skew it.
  recentSold: { medianJpy: number; minJpy: number; maxJpy: number; count: number } | null;
  jpyToIdr: number | null;
  fetchedAt: string;
};

type UsedItem = {
  price: number;
  status: number;
  apparel?: { name?: string; localizedName?: string };
};

async function usedListings(apparelId: string, params: Record<string, string>): Promise<UsedItem[]> {
  const query = new URLSearchParams({
    page: "1",
    conditionIds: String(PSA10_CONDITION_ID),
    ...params,
  });
  const res = await fetch(`https://snkrdunk.com/v1/apparels/${apparelId}/used?${query}`, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SNKRDUNK responded ${res.status}`);
  const data = (await res.json()) as { apparelUsedItems?: UsedItem[] };
  if (!Array.isArray(data.apparelUsedItems)) throw new Error("Unexpected SNKRDUNK response");
  return data.apparelUsedItems;
}

// Thrown errors are not cached by unstable_cache, so a blocked or changed
// endpoint is retried on the next click rather than stuck for a day.
export const fetchPsa10 = unstable_cache(
  async (apparelId: string): Promise<Omit<Psa10Reference, "jpyToIdr">> => {
    const [cheapestForSale, newest] = await Promise.all([
      usedListings(apparelId, { perPage: "1", order: "price", isSaleOnly: "true" }),
      usedListings(apparelId, { perPage: "50", order: "", isSaleOnly: "false" }),
    ]);

    const soldPrices = newest
      .filter((i) => i.status !== FOR_SALE_STATUS)
      .slice(0, RECENT_SOLD_SAMPLE)
      .map((i) => i.price)
      .sort((a, b) => a - b);
    const mid = Math.floor(soldPrices.length / 2);
    const apparel = (cheapestForSale[0] ?? newest[0])?.apparel;

    return {
      apparelId,
      cardName: apparel?.name ?? apparel?.localizedName ?? null,
      lowestAskJpy: cheapestForSale[0]?.price ?? null,
      recentSold:
        soldPrices.length > 0
          ? {
              medianJpy:
                soldPrices.length % 2 ? soldPrices[mid] : Math.round((soldPrices[mid - 1] + soldPrices[mid]) / 2),
              minJpy: soldPrices[0],
              maxJpy: soldPrices[soldPrices.length - 1],
              count: soldPrices.length,
            }
          : null,
      fetchedAt: new Date().toISOString(),
    };
  },
  ["snkrdunk-psa10"],
  { revalidate: CACHE_SECONDS }
);

// Rough JPY → IDR for the admin readout only. Best-effort: a failed lookup
// just leaves the IDR estimate off.
export const fetchJpyToIdr = unstable_cache(
  async (): Promise<number> => {
    const res = await fetch("https://open.er-api.com/v6/latest/JPY", { cache: "no-store" });
    const data = (await res.json()) as { result?: string; rates?: { IDR?: number } };
    if (data.result !== "success" || !data.rates?.IDR) throw new Error("Exchange rate unavailable");
    return data.rates.IDR;
  },
  ["jpy-to-idr"],
  { revalidate: CACHE_SECONDS }
);

