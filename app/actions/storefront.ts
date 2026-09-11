"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getWishlistProductIds } from "@/app/actions/customer";
import { getActiveDiscounts } from "@/app/actions/discounts";
import { priceWithDiscounts, badgesByProduct } from "@/lib/discounts";
import { isSlabProduct, isBoosterBoxProduct } from "@/lib/productCategory";
import type { StorefrontShortcut } from "@/lib/types";

const DEFAULT_DIRECT_PRICE_PCT = 1.15;

export type StorefrontPreorder = { days?: number; date?: string };

export type StorefrontProduct = {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  price: number | null;
  // Pre-discount price, only set when an active discount actually lowered
  // `price` — for showing it crossed out next to the discounted price.
  originalPrice: number | null;
  // Promotional badge text (e.g. "SALE") from an assigned discount's
  // badgeText — null shows nothing. See lib/discounts.ts badgesByProduct.
  badge: string | null;
  preorder: StorefrontPreorder | null;
  tags: string[];
  setName: string | null;
  setLanguage: "en" | "jp" | "id" | null;
  // Only populated by searchStorefrontProducts (the one listing that's
  // stock-aware) — undefined everywhere else (featured carousels, related
  // products, etc.), where it's treated as "in stock" since those don't
  // filter by quantity.
  inStock?: boolean;
};

// Batch-resolves set_id -> {name, language} for a list of products in one
// query, rather than one lookup per product.
async function resolveSetInfo(
  setIds: (string | null | undefined)[]
): Promise<Map<string, { name: string; language: "en" | "jp" | "id" }>> {
  const ids = [...new Set(setIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase.from("card_sets").select("id, name, language").in("id", ids);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((s) => [s.id, { name: s.name, language: s.language }]));
}

type BatchInfo = {
  price: number | null;
  originalPrice: number | null;
  badge: string | null;
  preorder: StorefrontPreorder | null;
};

function batchInfo(b: {
  cost: number;
  direct_price: number | null;
  is_preorder: boolean;
  preorder_duration_days: number | null;
  preorder_arrival_date: string | null;
}): Omit<BatchInfo, "originalPrice" | "badge"> {
  return {
    // An explicit direct_price of 0 means no real price has been set for
    // this batch (a placeholder, not a free item) — treat it as unpriced
    // rather than falling through to a literal IDR 0 price.
    price: b.direct_price === 0 ? null : (b.direct_price ?? b.cost * DEFAULT_DIRECT_PRICE_PCT),
    preorder: b.is_preorder
      ? { days: b.preorder_duration_days ?? undefined, date: b.preorder_arrival_date ?? undefined }
      : null,
  };
}

// Applies each product's best active percentage/fixed discount (if any) on
// top of its base batch price — a second, independent server-role lookup
// alongside the batch price itself, same "never trust anything but the final
// computed number" reasoning as batchInfo above.
async function applyDiscounts(base: Map<string, Omit<BatchInfo, "originalPrice" | "badge">>): Promise<Map<string, BatchInfo>> {
  const discounts = await getActiveDiscounts();
  // Unpriced batches (price null) skip discounting entirely — there's no
  // base price to discount off of.
  const basePrices = new Map<string, number>();
  for (const [id, info] of base) {
    if (info.price !== null) basePrices.set(id, info.price);
  }
  const discounted = priceWithDiscounts(basePrices, discounts);
  const badges = badgesByProduct(discounts);

  const infos = new Map<string, BatchInfo>();
  for (const [id, info] of base) {
    if (info.price === null) {
      infos.set(id, { price: null, originalPrice: null, badge: null, preorder: info.preorder });
      continue;
    }
    const d = discounted.get(id)!;
    infos.set(id, { price: d.price, originalPrice: d.originalPrice, badge: badges.get(id) ?? null, preorder: info.preorder });
  }
  return infos;
}

// Batch cost/pricing data is internal — looked up here with the service
// role (server-only, never sent to the client) so only the final computed
// price is ever returned, never the underlying cost.
async function priceByProductId(productIds: string[]): Promise<Map<string, BatchInfo>> {
  if (productIds.length === 0) return new Map();

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await service
    .from("inventory_batches")
    .select("product_id, cost, direct_price, is_preorder, preorder_duration_days, preorder_arrival_date")
    .in("product_id", productIds)
    .eq("is_storefront_price", true);
  if (error) throw new Error(error.message);

  const base = new Map<string, Omit<BatchInfo, "originalPrice" | "badge">>();
  for (const b of data ?? []) {
    base.set(b.product_id, batchInfo(b));
  }
  return applyDiscounts(base);
}

export type StorefrontCategory = "booster_boxes" | "singles" | "slabs" | "other";

export type StorefrontFilters = {
  brand?: "pokemon" | "one_piece";
  setId?: string;
  category?: StorefrontCategory;
};

function matchesCategory(p: { tags: string[] | null; name: string }, category: StorefrontCategory) {
  const tags = (p.tags ?? []).map((t) => t.toLowerCase());
  const isBooster = isBoosterBoxProduct(p);
  const isSingle = tags.includes("single");
  const isSlab = isSlabProduct(p);

  if (category === "booster_boxes") return isBooster;
  if (category === "singles") return isSingle;
  if (category === "slabs") return isSlab;
  return !isBooster && !isSingle && !isSlab;
}

export async function searchStorefrontProducts(
  query: string,
  filters: StorefrontFilters = {}
): Promise<StorefrontProduct[]> {
  // Strip characters that are syntax in PostgREST's .or() filter string
  // (commas separate conditions, parens group them) so a search term
  // containing them can't break or alter the query.
  const trimmed = query.trim().replace(/[,()]/g, "");
  const hasFilters = Boolean(filters.brand || filters.setId || filters.category);
  if (!trimmed && !hasFilters) return [];

  const supabase = await createClient();

  // A search term can also name a set (e.g. "evolving skies") rather than
  // appearing in the product name/tags directly — resolve matching set ids
  // up front so they can be OR'd into the same products query below.
  let matchingSetIds: string[] = [];
  if (trimmed) {
    const { data: matchingSets } = await supabase.from("card_sets").select("id").ilike("name", `%${trimmed}%`);
    matchingSetIds = (matchingSets ?? []).map((s) => s.id);
  }

  const PRODUCT_COLUMNS = "id, name, sku, image_url, tags, set_id, show_when_oos";

  let builder = supabase.from("products").select(PRODUCT_COLUMNS);
  if (trimmed) {
    const orParts = [`name.ilike.%${trimmed}%`, `sku.ilike.%${trimmed}%`];
    if (matchingSetIds.length > 0) orParts.push(`set_id.in.(${matchingSetIds.join(",")})`);
    builder = builder.or(orParts.join(","));
  }
  if (filters.brand) builder = builder.eq("brand", filters.brand);
  if (filters.setId) builder = builder.eq("set_id", filters.setId);

  const { data, error } = await builder.order("name", { ascending: true }).limit(200);
  if (error) throw new Error(error.message);
  let products = data ?? [];

  // Short queries (e.g. "etb", "psa") are almost always a whole-word acronym,
  // not a fragment — but SQL ILIKE matches them as a raw substring anywhere,
  // including inside an unrelated longer word (e.g. "etb" inside "Basketbal").
  // For those, require a real word-boundary match instead of trusting the
  // ILIKE hit, so search results aren't polluted by such coincidental hits.
  // Longer queries keep plain substring matching, which real partial-name
  // searches (e.g. "traine" for "Trainer") rely on.
  const isShortToken = trimmed.length > 0 && trimmed.length <= 4 && !/\s/.test(trimmed);
  if (isShortToken) {
    const escaped = trimmed.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wordBoundary = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
    const matchingSetIdSet = new Set(matchingSetIds);
    products = products.filter(
      (p) =>
        (p.set_id && matchingSetIdSet.has(p.set_id)) ||
        wordBoundary.test(p.name) ||
        (p.sku && wordBoundary.test(p.sku))
    );
  }

  // PostgREST can't ilike-match substrings inside a text[] column, so tag
  // search is a separate query (same brand/set filters, no text predicate)
  // merged in here — same two-query-then-merge approach getRelatedProducts
  // already uses for its tag-overlap search below.
  if (trimmed) {
    const q = trimmed.toLowerCase();
    let tagBuilder = supabase.from("products").select(PRODUCT_COLUMNS);
    if (filters.brand) tagBuilder = tagBuilder.eq("brand", filters.brand);
    if (filters.setId) tagBuilder = tagBuilder.eq("set_id", filters.setId);
    const { data: tagCandidates } = await tagBuilder.limit(1000);

    const seenIds = new Set(products.map((p) => p.id));
    for (const p of tagCandidates ?? []) {
      if (seenIds.has(p.id)) continue;
      // Tags are a curated vocabulary of short single tokens (see the
      // storefront_shortcuts/products tag list) — for a short query, an
      // exact tag match is what's meant; substring would reintroduce the
      // same false-positive risk as the name/sku check above.
      const tagMatches = isShortToken
        ? (p.tags ?? []).some((t: string) => t.toLowerCase() === q)
        : (p.tags ?? []).some((t: string) => t.toLowerCase().includes(q));
      if (tagMatches) {
        products.push(p);
        seenIds.add(p.id);
      }
    }
  }

  if (filters.category) {
    products = products.filter((p) => matchesCategory(p, filters.category!));
  }

  // Name matches are the primary signal — rank them ahead of products that
  // only matched via tag/set/SKU. Array.prototype.sort is stable, so within
  // each group products stay in the alphabetical order the query already
  // returned them in.
  if (trimmed) {
    const q = trimmed.toLowerCase();
    products = [...products].sort((a, b) => {
      const aMatch = a.name.toLowerCase().includes(q) ? 0 : 1;
      const bMatch = b.name.toLowerCase().includes(q) ? 0 : 1;
      return aMatch - bMatch;
    });
  }

  const infos = await priceByProductId(products.map((p) => p.id));
  const setInfos = await resolveSetInfo(products.map((p) => p.set_id));
  const availability = await getStorefrontAvailability(products.map((p) => p.id));
  const availableByProduct = new Map(availability.map((a) => [a.productId, a.available]));
  const showWhenOosByProduct = new Map(products.map((p) => [p.id, p.show_when_oos]));

  // Only show products that have a batch selected for storefront pricing.
  const withStock: StorefrontProduct[] = products
    .filter((p) => infos.has(p.id))
    .map((p) => {
      const info = infos.get(p.id)!;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        image_url: p.image_url,
        tags: p.tags ?? [],
        setName: p.set_id ? (setInfos.get(p.set_id)?.name ?? null) : null,
        setLanguage: p.set_id ? (setInfos.get(p.set_id)?.language ?? null) : null,
        ...info,
        inStock: (availableByProduct.get(p.id) ?? 0) > 0,
      };
    });

  // Out-of-stock products are hidden by default; show_when_oos opts a
  // specific product back in, sorted after every in-stock result (both
  // groups keep the name-ascending order from the query above).
  const inStock = withStock.filter((p) => p.inStock);
  const oosShown = withStock.filter((p) => !p.inStock && showWhenOosByProduct.get(p.id));

  return [...inStock, ...oosShown].slice(0, 24);
}

export async function getRecommendedProducts(limit = 8): Promise<StorefrontProduct[]> {
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: batches, error: batchesError } = await service
    .from("inventory_batch_availability")
    .select("product_id, cost, direct_price, is_preorder, preorder_duration_days, preorder_arrival_date")
    .eq("is_storefront_price", true)
    .gt("storefront_available", 0);
  if (batchesError) throw new Error(batchesError.message);
  if (!batches || batches.length === 0) return [];

  const randomPick = [...batches].sort(() => Math.random() - 0.5).slice(0, limit);
  const base = new Map<string, Omit<BatchInfo, "originalPrice" | "badge">>();
  for (const b of randomPick) {
    base.set(b.product_id, batchInfo(b));
  }
  const infos = await applyDiscounts(base);

  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, sku, image_url, tags, set_id")
    .in("id", [...infos.keys()]);
  if (error) throw new Error(error.message);

  const setInfos = await resolveSetInfo((products ?? []).map((p) => p.set_id));
  return (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    image_url: p.image_url,
    tags: p.tags ?? [],
    setName: p.set_id ? (setInfos.get(p.set_id)?.name ?? null) : null,
    setLanguage: p.set_id ? (setInfos.get(p.set_id)?.language ?? null) : null,
    ...infos.get(p.id)!,
  }));
}

export async function getFeaturedProducts(
  section: "featured_section_1" | "featured_section_2",
  limit = 8
): Promise<StorefrontProduct[]> {
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, sku, image_url, tags, set_id")
    .eq(section, true)
    .order(`${section}_order`, { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  if (!products || products.length === 0) return [];

  const infos = await priceByProductId(products.map((p) => p.id));
  const setInfos = await resolveSetInfo(products.map((p) => p.set_id));
  return products
    .filter((p) => infos.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      image_url: p.image_url,
      tags: p.tags ?? [],
      setName: p.set_id ? (setInfos.get(p.set_id)?.name ?? null) : null,
      setLanguage: p.set_id ? (setInfos.get(p.set_id)?.language ?? null) : null,
      ...infos.get(p.id)!,
    }));
}

export async function getStorefrontSectionTitles(): Promise<
  Record<"featured_section_1" | "featured_section_2", string>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("storefront_sections").select("id, title");
  if (error) throw new Error(error.message);

  const titles: Record<"featured_section_1" | "featured_section_2", string> = {
    featured_section_1: "Section 1",
    featured_section_2: "Section 2",
  };
  for (const row of data ?? []) {
    if (row.id === "featured_section_1" || row.id === "featured_section_2") {
      titles[row.id as "featured_section_1" | "featured_section_2"] = row.title;
    }
  }
  return titles;
}

async function productsByIds(ids: string[]): Promise<StorefrontProduct[]> {
  if (ids.length === 0) return [];

  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, sku, image_url, tags, set_id")
    .in("id", ids);
  if (error) throw new Error(error.message);

  const infos = await priceByProductId((products ?? []).map((p) => p.id));
  const setInfos = await resolveSetInfo((products ?? []).map((p) => p.set_id));
  return (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    image_url: p.image_url,
    tags: p.tags ?? [],
    setName: p.set_id ? (setInfos.get(p.set_id)?.name ?? null) : null,
    setLanguage: p.set_id ? (setInfos.get(p.set_id)?.language ?? null) : null,
    price: infos.get(p.id)?.price ?? null,
    originalPrice: infos.get(p.id)?.originalPrice ?? null,
    badge: infos.get(p.id)?.badge ?? null,
    preorder: infos.get(p.id)?.preorder ?? null,
  }));
}

export async function getWishlistProducts(): Promise<StorefrontProduct[]> {
  const ids = await getWishlistProductIds();
  return productsByIds(ids);
}

// Current name/image/price for a past order's products — price is null (and
// filtered out by the caller) for anything no longer stocked, so "buy again"
// never re-adds an item at a stale historical price.
export async function getProductsForReorder(productIds: string[]): Promise<StorefrontProduct[]> {
  return productsByIds([...new Set(productIds)]);
}

export type StorefrontProductDetail = StorefrontProduct & {
  brand: "pokemon" | "one_piece" | null;
  offersEnabled: boolean;
};

export async function getStorefrontProductDetail(
  id: string
): Promise<StorefrontProductDetail | null> {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select("id, name, sku, image_url, tags, brand, set_id, offers_enabled")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!product) return null;

  const { data: set, error: setError } = product.set_id
    ? await supabase.from("card_sets").select("name, language").eq("id", product.set_id).maybeSingle()
    : { data: null, error: null };
  if (setError) throw new Error(setError.message);

  const infos = await priceByProductId([product.id]);
  const info = infos.get(product.id);
  if (!info) return null; // not sellable on the storefront (no storefront price set)

  const availability = await getStorefrontAvailability([product.id]);
  const inStock = (availability[0]?.available ?? 0) > 0;

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    image_url: product.image_url,
    tags: product.tags ?? [],
    brand: product.brand,
    setName: set?.name ?? null,
    setLanguage: set?.language ?? null,
    offersEnabled: product.offers_enabled,
    inStock,
    ...info,
  };
}

// Generic/common words that show up in most card product names and so carry
// no signal for "same-ish item" (grades, condition, packaging terms, etc.).
const NAME_TOKEN_STOPWORDS = new Set([
  "the", "and", "for", "box", "pack", "packs", "set", "card", "cards", "psa",
  "etb", "bb", "upc", "edition", "japanese", "english", "indonesia",
  "special", "booster", "collection", "unopened",
]);

export async function getRelatedProducts(
  productId: string,
  limit = 8
): Promise<StorefrontProduct[]> {
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("products")
    .select("id, name, tags")
    .eq("id", productId)
    .maybeSingle();
  if (!current) return [];

  const currentTags = current.tags ?? [];
  const nameTokens = [
    ...new Set(
      current.name
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t: string) => t.length >= 3 && !NAME_TOKEN_STOPWORDS.has(t) && Number.isNaN(Number(t)))
    ),
  ];

  type Candidate = {
    id: string;
    name: string;
    sku: string | null;
    image_url: string | null;
    tags: string[];
    set_id: string | null;
    score: number;
  };
  const candidates = new Map<string, Candidate>();

  if (currentTags.length > 0) {
    const { data: byTag } = await supabase
      .from("products")
      .select("id, name, sku, image_url, tags, set_id")
      .neq("id", productId)
      .overlaps("tags", currentTags)
      .limit(50);
    for (const p of byTag ?? []) {
      const shared = (p.tags ?? []).filter((t: string) => currentTags.includes(t)).length;
      // Weighted higher than a name-token hit — a shared tag is a curated,
      // deliberate signal; a name-token match is just incidental wording.
      candidates.set(p.id, {
        id: p.id,
        name: p.name,
        sku: p.sku,
        image_url: p.image_url,
        tags: p.tags ?? [],
        set_id: p.set_id,
        score: shared * 2,
      });
    }
  }

  if (nameTokens.length > 0) {
    const orFilter = nameTokens.slice(0, 6).map((t) => `name.ilike.%${t}%`).join(",");
    const { data: byName } = await supabase
      .from("products")
      .select("id, name, sku, image_url, tags, set_id")
      .neq("id", productId)
      .or(orFilter)
      .limit(50);
    for (const p of byName ?? []) {
      const existing = candidates.get(p.id);
      if (existing) {
        existing.score += 1;
      } else {
        candidates.set(p.id, {
          id: p.id,
          name: p.name,
          sku: p.sku,
          image_url: p.image_url,
          tags: p.tags ?? [],
          set_id: p.set_id,
          score: 1,
        });
      }
    }
  }

  const ranked = [...candidates.values()].sort((a, b) => b.score - a.score);
  const infos = await priceByProductId(ranked.map((c) => c.id));
  const setInfos = await resolveSetInfo(ranked.map((c) => c.set_id));

  return ranked
    .filter((c) => infos.has(c.id))
    .slice(0, limit)
    .map((c) => {
      const info = infos.get(c.id)!;
      return {
        id: c.id,
        name: c.name,
        sku: c.sku,
        image_url: c.image_url,
        tags: c.tags,
        setName: c.set_id ? (setInfos.get(c.set_id)?.name ?? null) : null,
        setLanguage: c.set_id ? (setInfos.get(c.set_id)?.language ?? null) : null,
        ...info,
      };
    });
}

export type SaleEvent = { date: string; price: number };

// Order/order_line rows are staff-only (RLS), so this runs on the service
// role — but only each sale's date and the price the customer actually paid
// cross back to the public product page (a price-history chart, not a
// margin one), never cost, customer info, or individual order rows.
export async function getStorefrontProductRecentSales(
  productId: string,
  limit = 20
): Promise<SaleEvent[]> {
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // order_lines.created_at (and orders.created_at) are just DB-insert audit
  // timestamps — for rows migrated from the old system they all cluster on
  // the migration date, not the real sale date. orders.date is the actual
  // business date and is what customers should see here.
  //
  // Sorted in JS rather than via `.order(..., { foreignTable: "orders" })` —
  // that embedded-table ordering doesn't reliably apply through PostgREST's
  // join here (empirically still came back ascending with ascending:false),
  // so it's safer to fetch and sort ourselves.
  const { data, error } = await service
    .from("order_lines")
    .select("price, orders(date, status)")
    .eq("product_id", productId);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => ({
      price: row.price as number,
      order: row.orders as unknown as { date: string | null; status: string } | null,
    }))
    .filter(
      (row): row is { price: number; order: { date: string; status: string } } =>
        Boolean(row.order?.date) && row.order?.status !== "cancelled"
    )
    .sort((a, b) => b.order.date.localeCompare(a.order.date))
    .slice(0, limit)
    .map((row) => ({ date: row.order.date, price: row.price }))
    .reverse();
}

// Live stock for the storefront-priced batch of each product — used by the
// cart drawer to cap "+" at what's actually available, mirroring the same
// check createOrderAndCharge does server-side at checkout time.
export async function getStorefrontAvailability(
  productIds: string[]
): Promise<{ productId: string; available: number }[]> {
  if (productIds.length === 0) return [];

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await service
    .from("inventory_batch_availability")
    .select("product_id, storefront_available")
    .in("product_id", productIds)
    .eq("is_storefront_price", true);
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    productId: r.product_id,
    available: Math.max(0, r.storefront_available),
  }));
}

// "Notify me" signup from the OOS card CTA (app/(storefront)/ProductCard.tsx) — a
// customer isn't necessarily signed in, so this writes via the service role
// like offers/card_requests submissions do. Staff review at
// /stock-notifications (app/actions/adminStockNotifications.ts).
export async function submitStockNotification(
  productId: string,
  params: { email: string; phone: string }
): Promise<{ error?: string }> {
  const email = params.email.trim().toLowerCase();
  const phone = params.phone.trim();
  if (!email && !phone) return { error: "Enter an email or phone number" };

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await service.from("stock_notifications").insert({
    product_id: productId,
    email: email || null,
    phone: phone || null,
  });
  if (error) return { error: error.message };
  return {};
}

export async function getPopularKeywords(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("popular_keywords")
    .select("keyword")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.keyword);
}

export async function getStorefrontShortcuts(): Promise<StorefrontShortcut[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("storefront_shortcuts")
    .select("id, label, href, image_url, badge, position")
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as StorefrontShortcut[];
}

// Anonymous view event, feeding a future "People often visit" section (see
// getMostViewedProducts below). Skipped outside production so local dev/QA
// traffic doesn't skew real visit counts. Best-effort: a write failure here
// (missing table, transient DB hiccup, etc.) must never take down the
// product page itself, so errors are logged rather than thrown.
export async function recordProductView(productId: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await service.from("product_views").insert({ product_id: productId });
  if (error) console.error("recordProductView failed:", error.message);
}

// Not wired into any page yet — ready for whenever a "People often visit"
// section gets built. Ranks by view count within the last `days` days.
export async function getMostViewedProducts(limit = 8, days = 30): Promise<StorefrontProduct[]> {
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await service
    .from("product_views")
    .select("product_id")
    .gte("viewed_at", since);
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit * 2);
  if (ranked.length === 0) return [];

  const supabase = await createClient();
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, sku, image_url, tags, set_id")
    .in(
      "id",
      ranked.map(([id]) => id)
    );
  if (productsError) throw new Error(productsError.message);

  const infos = await priceByProductId((products ?? []).map((p) => p.id));
  const setInfos = await resolveSetInfo((products ?? []).map((p) => p.set_id));
  const rankIndex = new Map(ranked.map(([id], i) => [id, i]));

  return (products ?? [])
    .filter((p) => infos.has(p.id))
    .sort((a, b) => (rankIndex.get(a.id) ?? 0) - (rankIndex.get(b.id) ?? 0))
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      image_url: p.image_url,
      tags: p.tags ?? [],
      setName: p.set_id ? (setInfos.get(p.set_id)?.name ?? null) : null,
      setLanguage: p.set_id ? (setInfos.get(p.set_id)?.language ?? null) : null,
      ...infos.get(p.id)!,
    }));
}

export type FeaturedSetStatus = "in-stock" | "low-stock" | "sold-out";

export type FeaturedSet = {
  productId: string;
  code: string | null;
  name: string;
  era: string | null;
  releasedAt: string | null;
  status: FeaturedSetStatus;
  boxPrice: number | null;
  packsPerBox: number | null;
  cardsPerPack: number | null;
  boxImage: string | null;
  logoImage: string | null;
  language: string;
  href: string;
};

type FeaturedSetMeta = {
  productId: string;
  code: string | null;
  era: string | null;
  releasedAt: string | null;
  packsPerBox: number | null;
  cardsPerPack: number | null;
  logoImage: string | null;
};

// Shared by getJpFeaturedSets/getIdFeaturedSets below — looks up each
// listed product's live price/stock and box photo, and layers the
// hand-supplied catalog metadata (code/era/release date/pack contents/logo)
// on top since none of that is tracked in the products/inventory tables.
async function resolveFeaturedSets(meta: FeaturedSetMeta[], language: string): Promise<FeaturedSet[]> {
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const productIds = meta.map((s) => s.productId);

  const [{ data: products, error: productsError }, { data: batches, error: batchesError }] =
    await Promise.all([
      service.from("products").select("id, name, image_url").in("id", productIds),
      service
        .from("inventory_batch_availability")
        .select("product_id, direct_price, storefront_available")
        .eq("is_storefront_price", true)
        .in("product_id", productIds),
    ]);
  if (productsError) throw new Error(productsError.message);
  if (batchesError) throw new Error(batchesError.message);

  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const priceInfoByProduct = new Map((batches ?? []).map((b) => [b.product_id, b]));

  return meta
    .map((m) => {
      const product = productById.get(m.productId);
      const priceInfo = priceInfoByProduct.get(m.productId);
      const available = priceInfo?.storefront_available ?? 0;
      const status: FeaturedSetStatus = available <= 0 ? "sold-out" : available <= 3 ? "low-stock" : "in-stock";

      return {
        productId: m.productId,
        code: m.code,
        name: product?.name ?? "Unknown set",
        era: m.era,
        releasedAt: m.releasedAt,
        status,
        boxPrice: priceInfo?.direct_price ?? null,
        packsPerBox: m.packsPerBox,
        cardsPerPack: m.cardsPerPack,
        boxImage: product?.image_url ?? null,
        logoImage: m.logoImage,
        language,
        href: `/products/${m.productId}`,
      };
    })
    .sort((a, b) => (b.releasedAt ?? "").localeCompare(a.releasedAt ?? ""));
}

// Set code, JP release date, and pack contents aren't tracked anywhere in
// the products/inventory tables — they're supplied by hand here per
// featured set until (if ever) that becomes real catalog data. Price,
// stock, and the box photo below are pulled live so those never go stale.
//
// code/releasedAt/logoImage sourced from tcgseal.id's catalog (backed by
// Scrydex) — logos downloaded into public/sets/ rather than hotlinked.
// TODO: packsPerBox/cardsPerPack (booster box contents, not tracked by that
// catalog) are still unknown — fill in the real values once you have them.
const JP_FEATURED_SETS: FeaturedSetMeta[] = [
  {
    // Code/release date from tcgseal.id's catalog (sourced from Scrydex,
    // scrydexId "m6_ja"). packsPerBox/cardsPerPack still unknown.
    productId: "ca5fb482-1c49-486e-b5a6-eac56113b4c2", // Storm Emeralda
    code: "M6",
    era: "Mega Evolution",
    releasedAt: "2026-07-31",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: "/sets/storm-emeralda-logo.png",
  },
  {
    // scrydexId "m5_ja".
    productId: "887c05f7-0726-42c9-9de7-4366a196a1c3", // Abyss Eye
    code: "M5",
    era: "Mega Evolution",
    releasedAt: "2026-05-22",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: "/sets/abyss-eye-logo.png",
  },
  {
    // scrydexId "m4_ja".
    productId: "e8553842-0907-4792-813a-3c0b2520f0f8", // Ninja Spinner
    code: "M4",
    era: "Mega Evolution",
    releasedAt: "2026-03-13",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: "/sets/ninja-spinner-logo.png",
  },
  {
    // scrydexId "m3_ja".
    productId: "2023ce71-4fa5-4d69-9143-b3cd596232ea", // Munikis Zero
    code: "M3",
    era: "Mega Evolution",
    releasedAt: "2026-01-23",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: "/sets/munikis-zero-logo.png",
  },
  {
    // scrydexId "m2a_ja".
    productId: "9f13a1bb-110f-43a0-9fc1-18260e54d747", // Mega Dream
    code: "M2A",
    era: "Mega Evolution",
    releasedAt: "2025-11-28",
    packsPerBox: 10,
    cardsPerPack: 10,
    logoImage: "/sets/mega-dream-logo.png",
  },
  {
    // scrydexId "m2_ja".
    productId: "db719196-8e01-4d5e-88a3-d5ec01dc351a", // Inferno X
    code: "M2",
    era: "Mega Evolution",
    releasedAt: "2025-09-26",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: "/sets/inferno-x-logo.png",
  },
  {
    // scrydexId "m1s_ja".
    productId: "91adef88-20ec-466e-abdf-9304df2608c0", // Mega Symphonia
    code: "M1S",
    era: "Mega Evolution",
    releasedAt: "2025-08-01",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: "/sets/mega-symphonia-logo.png",
  },
  {
    // scrydexId "m1l_ja".
    productId: "0561353d-0524-4cd9-8d4d-ec9746f327f2", // Mega Brave
    code: "M1L",
    era: "Mega Evolution",
    releasedAt: "2025-08-01",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: "/sets/mega-brave-logo.png",
  },
  {
    // scrydexId "sv11b_ja". Product chosen among 3 name matches ("ETB Black
    // Bolt", "Black Bolt Booster Bundle", "Black Bolt") as the one matching
    // every other entry's PKMBBX<name> booster-box SKU convention.
    productId: "e2e2632b-7abc-4791-bd65-29d043f7f18a", // Black Bolt
    code: "SV11B",
    era: "Scarlet & Violet",
    releasedAt: "2025-06-06",
    packsPerBox: 20,
    cardsPerPack: 8,
    logoImage: "/sets/black-bolt-logo.png",
  },
  {
    // scrydexId "sv11w_ja".
    productId: "7bcd5441-6aae-484f-8cc8-d0afcaab5824", // White Flare
    code: "SV11W",
    era: "Scarlet & Violet",
    releasedAt: "2025-06-06",
    packsPerBox: 20,
    cardsPerPack: 8,
    logoImage: "/sets/white-flare-logo.png",
  },
  {
    // scrydexId "sv10_ja".
    productId: "a0d9e64c-a6da-40e3-87fa-05ac8bb81a07", // Glory of Team Rocket
    code: "SV10",
    era: "Scarlet & Violet",
    releasedAt: "2025-04-18",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: "/sets/glory-of-team-rocket-logo.png",
  },
  {
    // scrydexId "sv9a_ja".
    productId: "3f151786-566e-429e-8cce-44b866ad8952", // HeatWave Arena
    code: "SV9a",
    era: "Scarlet & Violet",
    releasedAt: "2025-03-14",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: "/sets/heat-wave-arena-logo.png",
  },
  {
    // scrydexId "sv9_ja".
    productId: "d58133c7-18b6-4e4e-b001-ba937ea956d1", // Battle Partner
    code: "SV9",
    era: "Scarlet & Violet",
    releasedAt: "2025-01-24",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: "/sets/battle-partners-logo.png",
  },
  {
    // scrydexId "sv8a_ja".
    productId: "efd855d5-17f9-4cc8-8350-40b3dfbe70d1", // Terastal Festival
    code: "SV8A",
    era: "Scarlet & Violet",
    releasedAt: "2024-12-06",
    packsPerBox: 10,
    cardsPerPack: 10,
    logoImage: "/sets/terastal-festival-logo.png",
  },
  {
    // scrydexId "sv8_ja".
    productId: "22003032-0281-41dd-af7c-8b77397a762c", // Super Electric Breaker
    code: "SV8",
    era: "Scarlet & Violet",
    releasedAt: "2024-10-18",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: "/sets/super-electric-breaker-logo.png",
  },
  {
    // scrydexId "sv2a_ja".
    productId: "e55bd59e-dd8f-46d5-8951-d0924886f060", // Pokemon Card 151
    code: "SV2a",
    era: "Scarlet & Violet",
    releasedAt: "2023-06-16",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: "/sets/pokemon-151-logo.png",
  },
  {
    // scrydexId "swsh12a_ja".
    productId: "4632e0e0-fdcc-45bd-bcc6-5e453ee680a7", // VSTAR Universe
    code: "S12a",
    era: "Sword & Shield",
    releasedAt: "2022-12-02",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: "/sets/vstar-universe-logo.png",
  },
  {
    // scrydexId "swsh8b_ja".
    productId: "2e276881-a3eb-4c76-bb8c-ccf9253d3a90", // VMAX Climax
    code: "S8b",
    era: "Sword & Shield",
    releasedAt: "2021-12-03",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: "/sets/vmax-climax-logo.png",
  },
  {
    // scrydexId "swsh4a_ja".
    productId: "a58db201-4f63-4c9e-b0ab-f72f8c4f3daf", // Shiny Star V
    code: "S4a",
    era: "Sword & Shield",
    releasedAt: "2020-11-20",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: "/sets/shiny-star-v-logo.png",
  },
];

// Sorted newest release first; sets with no known release date sort last
// rather than floating to the top ahead of dated ones.
export async function getJpFeaturedSets(): Promise<FeaturedSet[]> {
  return resolveFeaturedSets(JP_FEATURED_SETS, "Japanese");
}

// Indonesian-market catalog data is far sparser than JP's — tcgseal.id (the
// source for JP code/releasedAt/logoImage) doesn't track Indonesia at all,
// and most Indonesian-language card_sets rows have no linked booster-box
// product yet. Fill in code/era/releasedAt/logoImage by hand per set, same
// as JP_FEATURED_SETS, as more become available.
const ID_FEATURED_SETS: FeaturedSetMeta[] = [
  {
    // Indonesian localization of JP's Abyss Eye-numbered slot in the Mega
    // Evolution series — "Void Blast" in English, MA5 I.
    productId: "95dc5456-169a-4834-b4d9-5e0adcbaa37e", // Ancaman Bayangan
    code: "MA5",
    era: "Evolusi Mega",
    releasedAt: "2026-06-26",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: null,
  },
  {
    // "Void Blast" in English, MA4 I.
    productId: "30be1e01-0863-436c-a4c4-223237ab352c", // Ledakan Peniada
    code: "MA4",
    era: "Evolusi Mega",
    releasedAt: "2026-04-03",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: null,
  },
  {
    // Localization of JP's Mega Dream (M2A) — "Mega Dream ex" in English,
    // MA3 I. High-class booster: 10 packs/box, 10 cards/pack (not the usual
    // 30/5).
    productId: "a72ef99a-2808-4b79-9629-a74fdaf3d657", // Mega Impian Ex
    code: "MA3",
    era: "Evolusi Mega",
    releasedAt: "2026-01-30",
    packsPerBox: 10,
    cardsPerPack: 10,
    logoImage: null,
  },
  {
    // Localization of JP's Munikis Zero-era Charizard release ("Blue Blaze"
    // in English), MA2 I — features Mega Charizard X ex. Released 2025-12-05
    // (per jagatplay.com), after an initial 2025-11-28 date slipped.
    productId: "98e062f4-10bb-4a0a-8839-e27df0f6cac8", // Kobaran Biru
    code: "MA2",
    era: "Evolusi Mega",
    releasedAt: "2025-12-05",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: null,
  },
  {
    // Indonesian market's launch set for the era — localizes JP's
    // Symphonia/Brave (M1S/M1L) split; "Mega Evolution" in English, MA1 I.
    // Released 2025-09-26 by AKG Entertainment (per psegameshop.com).
    productId: "0114d84b-a075-45e5-a6cc-7202deb81e8f", // Evolusi Mega
    code: "MA1",
    era: "Evolusi Mega",
    releasedAt: "2025-09-26",
    packsPerBox: 30,
    cardsPerPack: 5,
    logoImage: null,
  },
  {
    // Global simultaneous release (incl. Indonesian) — see
    // https://www.pokemon.com/us/pokemon-news/get-ready-for-pokemon-tcg-30th-celebration.
    // Set code unconfirmed for the Indonesian-market product specifically.
    productId: "80cc0c3c-02b1-4532-8696-3f30ce5cd823", // Poke Indo 30th CELEBRATION BB
    code: null,
    era: "Evolusi Mega",
    releasedAt: "2026-09-16",
    packsPerBox: 20,
    cardsPerPack: 8,
    logoImage: null,
  },
];

export async function getIdFeaturedSets(): Promise<FeaturedSet[]> {
  return resolveFeaturedSets(ID_FEATURED_SETS, "Indonesian");
}

// English sets link to their Elite Trainer Box product rather than a
// booster box (that's what ETB-tagged products cover here) — same
// resolveFeaturedSets href convention, just a different product per set.
// Only sets we actually carry an ETB for are listed. Where a set has more
// than one ETB variant in the catalog (Mega Evolution ships Gardevoir- and
// Lucario-cover versions, plus a Pokémon Center-exclusive Lucario one),
// whichever variant actually has a storefront price is used.
//
// code/releasedAt/logoImage sourced from tcgseal.id's catalog (backed by
// Scrydex), same as JP_FEATURED_SETS — logos downloaded into public/sets/.
// packsPerBox/cardsPerPack are a standard modern ETB estimate (9 packs of
// 10 cards), not verified per box.
const EN_FEATURED_SETS: FeaturedSetMeta[] = [
  {
    // scrydexId "me5".
    productId: "63a7f710-f5d9-4632-9c1c-3d2e55f0f03c", // Pitch Black Elite Trainer Box
    code: "ME5",
    era: "Mega Evolution",
    releasedAt: "2026-07-17",
    packsPerBox: 9,
    cardsPerPack: 10,
    logoImage: "/sets/pitch-black-logo.png",
  },
  {
    // scrydexId "me4". Not tagged "etb" in the catalog like the others (tag
    // hygiene gap), but it's the Chaos Rising Elite Trainer Box product.
    productId: "9d708247-4ca1-4d74-91c0-ffaae84c7728", // Chaos Rising Elite Trainer Box
    code: "ME4",
    era: "Mega Evolution",
    releasedAt: "2026-05-22",
    packsPerBox: 9,
    cardsPerPack: 10,
    logoImage: "/sets/chaos-rising-logo.png",
  },
  {
    // scrydexId "me3".
    productId: "0eb9e5d1-9542-4b5d-b2ac-1e723db33589", // Perfect Order Elite Trainer Box
    code: "ME3",
    era: "Mega Evolution",
    releasedAt: "2026-03-27",
    packsPerBox: 9,
    cardsPerPack: 10,
    logoImage: "/sets/perfect-order-logo.png",
  },
  {
    // scrydexId "me2pt5".
    productId: "98df3c22-9252-4f0a-ab70-9b0347ef3506", // Ascended Heroes Elite Trainer Box
    code: "ME2.5",
    era: "Mega Evolution",
    releasedAt: "2026-01-30",
    packsPerBox: 9,
    cardsPerPack: 10,
    logoImage: "/sets/ascended-heroes-logo.png",
  },
  {
    // scrydexId "me2".
    productId: "f15b12b1-001b-4cce-af4b-283b7ef4f6d8", // ETB Phantasmal Flames
    code: "ME2",
    era: "Mega Evolution",
    releasedAt: "2025-11-14",
    packsPerBox: 9,
    cardsPerPack: 10,
    logoImage: "/sets/phantasmal-flames-logo.png",
  },
  {
    // scrydexId "me1". Product chosen among 3 ETB variants (Gardevoir-cover,
    // Lucario-cover, Lucario Pokémon Center) as the one with a live
    // storefront price — the standard Lucario-cover ETB has no priced batch.
    productId: "3b1dcf19-07e5-4510-bbef-c12d246c1998", // ETB Mega Gardevoir
    code: "ME1",
    era: "Mega Evolution",
    releasedAt: "2025-09-26",
    packsPerBox: 9,
    cardsPerPack: 10,
    logoImage: "/sets/mega-evolution-logo.png",
  },
  {
    // scrydexId "zsv10pt5".
    productId: "e42e31d5-a96d-4437-876e-1e6aaf4c37de", // ETB Black Bolt
    code: "SV10.5",
    era: "Scarlet & Violet",
    releasedAt: "2025-07-18",
    packsPerBox: 9,
    cardsPerPack: 10,
    logoImage: "/sets/black-bolt-en-logo.png",
  },
  {
    // scrydexId "sv10".
    productId: "d9bddc59-0981-4d98-a160-8b2d5473ab59", // Destined Rivals Pokemon Center Elite Trainer box
    code: "SV10",
    era: "Scarlet & Violet",
    releasedAt: "2025-05-30",
    packsPerBox: 9,
    cardsPerPack: 10,
    logoImage: "/sets/destined-rivals-logo.png",
  },
  {
    // scrydexId "sv8pt5".
    productId: "f5161daa-c0ce-463e-bcb3-7d3b6b508fab", // Prismatic Evolution Elite Trainer Box
    code: "SV8.5",
    era: "Scarlet & Violet",
    releasedAt: "2025-01-17",
    packsPerBox: 9,
    cardsPerPack: 10,
    logoImage: "/sets/prismatic-evolutions-logo.png",
  },
  {
    // scrydexId "sv8".
    productId: "61a0af46-075e-4ce5-97dd-e91d962f21b2", // Surging Sparks Elite Trainer Box Pokemon Center
    code: "SV8",
    era: "Scarlet & Violet",
    releasedAt: "2024-11-08",
    packsPerBox: 9,
    cardsPerPack: 10,
    logoImage: "/sets/surging-sparks-logo.png",
  },
  {
    // scrydexId "sv3".
    productId: "7bd2a4a2-2969-4e31-9259-0e4f56c037b3", // ETB Obsidian Flames
    code: "SV3",
    era: "Scarlet & Violet",
    releasedAt: "2023-08-11",
    packsPerBox: 9,
    cardsPerPack: 10,
    logoImage: "/sets/obsidian-flames-logo.png",
  },
  {
    // scrydexId "cel25".
    productId: "f3cd0f4e-728f-4ff1-8464-4ec57836ccb3", // Elite Trainer Box Pokemon 25th Celebrations
    code: "CEL25",
    era: "25th Anniversary",
    releasedAt: "2021-10-08",
    packsPerBox: 9,
    cardsPerPack: 10,
    logoImage: "/sets/celebrations-logo.png",
  },
];

export async function getEnFeaturedSets(): Promise<FeaturedSet[]> {
  return resolveFeaturedSets(EN_FEATURED_SETS, "English");
}
