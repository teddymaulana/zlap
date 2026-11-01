import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSlabProduct } from "@/lib/productCategory";
import BulkPreorderTable, { type BulkPreorderRow } from "./BulkPreorderTable";

// Pre-order is for Japan-sourced PSA 10 slabs priced from SNKRDUNK, so this
// lists every slab, plus anything else that already has a SNKRDUNK link or
// pre-order turned on.
export default async function BulkPreordersPage() {
  const supabase = await createClient();
  const [{ data: products, error }, { data: openCounts, error: openCountsError }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, image_url, tags, snkrdunk_url, storefront_enabled, po_enabled, po_price, po_price_updated_at, po_markup_type, po_markup_value, po_open_limit"
      )
      .order("name", { ascending: true })
      .limit(1000),
    supabase.from("product_po_open").select("product_id, open_count"),
  ]);
  if (error) throw new Error(error.message);
  if (openCountsError) throw new Error(openCountsError.message);

  const openCountById = new Map((openCounts ?? []).map((r) => [r.product_id, Number(r.open_count)]));
  const rows: BulkPreorderRow[] = (products ?? [])
    .filter((p) => p.po_enabled || p.snkrdunk_url || isSlabProduct(p))
    .map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.image_url,
      snkrdunkUrl: p.snkrdunk_url,
      storefrontEnabled: p.storefront_enabled,
      poEnabled: p.po_enabled,
      poPrice: p.po_price === null ? null : Number(p.po_price),
      poPriceUpdatedAt: p.po_price_updated_at,
      markupType: p.po_markup_type,
      markupValue: Number(p.po_markup_value),
      openLimit: p.po_open_limit,
      openCount: openCountById.get(p.id) ?? 0,
    }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link href="/zlap-adm/preorders" className="text-sm text-gray-500 underline">
        ← Pre-order queue
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold">Bulk pre-order settings</h1>
      <p className="mb-6 text-sm text-gray-500">
        Turn pre-order on or off, or change the markup and open limit, for many slabs at once. A product needs a
        SNKRDUNK link and a fresh price before customers can pre-order it.
      </p>
      <BulkPreorderTable rows={rows} />
    </div>
  );
}
