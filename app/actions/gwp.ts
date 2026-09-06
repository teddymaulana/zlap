"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ALL_GIFT_TAGS } from "@/lib/gwp";

// Mirrors app/actions/storefront.ts's fallback for batches with no manual
// direct_price. Only the computed price is ever returned below — never the
// underlying cost.
const DEFAULT_DIRECT_PRICE_PCT = 1.15;

export type GiftCatalogItem = {
  id: string;
  name: string;
  image_url: string | null;
  tags: string[];
  // What this product would normally sell for, for the cart to show
  // "originally IDR X" crossed out next to "Free". These products are never
  // storefront-priced (see below), so this comes from their most recent
  // batch regardless of is_storefront_price. Null if a product has no batch.
  originalPrice: number | null;
};

// The 3 auto-GWP accessory products, for the cart's client-side preview
// (CartContext) to resolve an earned gift role to a real product to display.
// Never storefront-priced, so this is the only path that surfaces them.
export async function getGiftCatalog(): Promise<GiftCatalogItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, image_url, tags")
    .overlaps("tags", ALL_GIFT_TAGS);
  if (error) throw new Error(error.message);
  const products = data ?? [];

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: batches, error: batchError } = await service
    .from("inventory_batches")
    .select("product_id, cost, direct_price, created_at")
    .in("product_id", products.map((p) => p.id))
    .order("created_at", { ascending: false });
  if (batchError) throw new Error(batchError.message);

  const priceByProductId = new Map<string, number>();
  for (const b of batches ?? []) {
    if (priceByProductId.has(b.product_id)) continue; // keep only the latest batch
    priceByProductId.set(b.product_id, b.direct_price ?? b.cost * DEFAULT_DIRECT_PRICE_PCT);
  }

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    image_url: p.image_url,
    tags: p.tags ?? [],
    originalPrice: priceByProductId.get(p.id) ?? null,
  }));
}
