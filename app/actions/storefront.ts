"use server";

import { cookies } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getWishlistProductIds } from "@/app/actions/customer";
import { isSlabProduct } from "@/lib/productCategory";

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
    path: "/store",
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
  let builder = supabase.from("products").select("id, name, sku, image_url, tags, set_id");
  if (trimmed) {
    builder = builder.or(`name.ilike.%${trimmed}%,sku.ilike.%${trimmed}%`);
  }
  if (filters.brand) builder = builder.eq("brand", filters.brand);
  if (filters.setId) builder = builder.eq("set_id", filters.setId);

  const { data, error } = await builder.order("name", { ascending: true }).limit(200);
  if (error) throw new Error(error.message);
  let products = data ?? [];

  if (filters.category) {
    products = products.filter((p) => matchesCategory(p, filters.category!));
  }

  const infos = await priceByProductId(products.map((p) => p.id));
  const setNames = await resolveSetNames(products.map((p) => p.set_id));

  // Only show products that have a batch selected for storefront pricing.
  return products
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
      };
    })
    .slice(0, 24);
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
    .gt("available", 0);
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

export async function getWishlistProducts(): Promise<StorefrontProduct[]> {
  const ids = await getWishlistProductIds();
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

export type StorefrontProductDetail = StorefrontProduct & {
  brand: "pokemon" | "one_piece" | null;
};

export async function getStorefrontProductDetail(
  id: string
): Promise<StorefrontProductDetail | null> {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select("id, name, sku, image_url, tags, brand, set_id")
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
    .select("product_id, available")
    .in("product_id", productIds)
    .eq("is_storefront_price", true);
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({ productId: r.product_id, available: Math.max(0, r.available) }));
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

// Anonymous view event, feeding a future "People often visit" section (see
// getMostViewedProducts below). Skipped outside production so local dev/QA
// traffic doesn't skew real visit counts.
export async function recordProductView(productId: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await service.from("product_views").insert({ product_id: productId });
  if (error) throw new Error(error.message);
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
