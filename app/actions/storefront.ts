"use server";

import { cookies } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getWishlistProductIds } from "@/app/actions/customer";
import { isSlabProduct } from "@/lib/productCategory";
import type { StorefrontShortcut } from "@/lib/types";

const DEFAULT_DIRECT_PRICE_PCT = 1.15;

// Temporary dev gate for the storefront while it's under construction —
// swap for real access control before launch.
const STOREFRONT_PASSWORD = process.env.STOREFRONT_PASSWORD || "zlapdev";
const ACCESS_COOKIE = "storefront_access";

export async function unlockStorefront(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password !== STOREFRONT_PASSWORD) {
    return { error: "Incorrect password" };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, STOREFRONT_PASSWORD, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return { error: null };
}

export type StorefrontPreorder = { days?: number; date?: string };

export type StorefrontProduct = {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  price: number | null;
  preorder: StorefrontPreorder | null;
  tags: string[];
  setName: string | null;
  // Only populated by searchStorefrontProducts (the one listing that's
  // stock-aware) — undefined everywhere else (featured carousels, related
  // products, etc.), where it's treated as "in stock" since those don't
  // filter by quantity.
  inStock?: boolean;
};

// Batch-resolves set_id -> set name for a list of products in one query,
// rather than one lookup per product.
async function resolveSetNames(setIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = [...new Set(setIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase.from("card_sets").select("id, name").in("id", ids);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((s) => [s.id, s.name]));
}

type BatchInfo = { price: number; preorder: StorefrontPreorder | null };

function batchInfo(b: {
  cost: number;
  direct_price: number | null;
  is_preorder: boolean;
  preorder_duration_days: number | null;
  preorder_arrival_date: string | null;
}): BatchInfo {
  return {
    price: b.direct_price ?? b.cost * DEFAULT_DIRECT_PRICE_PCT,
    preorder: b.is_preorder
      ? { days: b.preorder_duration_days ?? undefined, date: b.preorder_arrival_date ?? undefined }
      : null,
  };
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

  const infos = new Map<string, BatchInfo>();
  for (const b of data ?? []) {
    infos.set(b.product_id, batchInfo(b));
  }
  return infos;
}

export type StorefrontCategory = "booster_boxes" | "singles" | "slabs" | "other";

export type StorefrontFilters = {
  brand?: "pokemon" | "one_piece";
  setId?: string;
  category?: StorefrontCategory;
};

function matchesCategory(p: { tags: string[] | null; name: string }, category: StorefrontCategory) {
  const tags = (p.tags ?? []).map((t) => t.toLowerCase());
  const isBooster = tags.some((t) => t.includes("booster_box") || t.includes("booster box"));
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
  const setNames = await resolveSetNames(products.map((p) => p.set_id));
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
        setName: p.set_id ? (setNames.get(p.set_id) ?? null) : null,
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
  const infos = new Map<string, BatchInfo>();
  for (const b of randomPick) {
    infos.set(b.product_id, batchInfo(b));
  }

  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, sku, image_url, tags, set_id")
    .in("id", [...infos.keys()]);
  if (error) throw new Error(error.message);

  const setNames = await resolveSetNames((products ?? []).map((p) => p.set_id));
  return (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    image_url: p.image_url,
    tags: p.tags ?? [],
    setName: p.set_id ? (setNames.get(p.set_id) ?? null) : null,
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
  const setNames = await resolveSetNames(products.map((p) => p.set_id));
  return products
    .filter((p) => infos.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      image_url: p.image_url,
      tags: p.tags ?? [],
      setName: p.set_id ? (setNames.get(p.set_id) ?? null) : null,
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
  const setNames = await resolveSetNames((products ?? []).map((p) => p.set_id));
  return (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    image_url: p.image_url,
    tags: p.tags ?? [],
    setName: p.set_id ? (setNames.get(p.set_id) ?? null) : null,
    price: infos.get(p.id)?.price ?? null,
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

  const setNames = await resolveSetNames([product.set_id]);
  const infos = await priceByProductId([product.id]);
  const info = infos.get(product.id);
  if (!info) return null; // not sellable on the storefront (no storefront price set)

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    image_url: product.image_url,
    tags: product.tags ?? [],
    brand: product.brand,
    setName: product.set_id ? (setNames.get(product.set_id) ?? null) : null,
    offersEnabled: product.offers_enabled,
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
  const setNames = await resolveSetNames(ranked.map((c) => c.set_id));

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
        setName: c.set_id ? (setNames.get(c.set_id) ?? null) : null,
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
  const setNames = await resolveSetNames((products ?? []).map((p) => p.set_id));
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
      setName: p.set_id ? (setNames.get(p.set_id) ?? null) : null,
      ...infos.get(p.id)!,
    }));
}
