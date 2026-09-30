import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { InventoryBatchAvailability, Product } from "@/lib/types";
import { PAGE_SIZE } from "@/lib/constants";
import Pagination from "@/app/Pagination";
import { isSlabProduct, isBoosterBoxProduct, isEtbProduct } from "@/lib/productCategory";

// Catalog gaps staff should fill in — the "Needs fix" filter shows only
// products with at least one of these, and each row lists which ones.
function productIssues(p: Product): string[] {
  const issues: string[] = [];
  if (!p.image_url) issues.push("No image");
  if (!p.sku) issues.push("No SKU");
  if (!p.brand) issues.push("No brand");
  else if (!p.set_id) issues.push("No set");
  if ((p.tags ?? []).length === 0) issues.push("No tags");
  return issues;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; fix?: string }>;
}) {
  const { page: pageParam, q, fix } = await searchParams;
  const query = (q ?? "").trim();
  const needsFix = fix === "1";
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const [{ data: allProducts, error: productsError }, { data: batches }, { data: storefrontBatches }] =
    await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("inventory_batch_availability").select("product_id, available"),
      supabase.from("inventory_batches").select("product_id").eq("is_storefront_price", true),
    ]);

  if (productsError) throw new Error(productsError.message);

  const availableByProduct = new Map<string, number>();
  for (const b of (batches ?? []) as Pick<InventoryBatchAvailability, "product_id" | "available">[]) {
    availableByProduct.set(
      b.product_id,
      (availableByProduct.get(b.product_id) ?? 0) + Math.max(0, b.available)
    );
  }

  // A product is "on the storefront" once one of its batches is picked as
  // the storefront price (see is_storefront_price in supabase/schema.sql) —
  // the same condition app/actions/storefront.ts uses to show it there.
  const storefrontProductIds = new Set(
    (storefrontBatches ?? []).map((b) => b.product_id as string)
  );

  const lowerQuery = query.toLowerCase();
  const matchingProducts = ((allProducts ?? []) as Product[]).filter(
    (p) =>
      !lowerQuery ||
      p.name.toLowerCase().includes(lowerQuery) ||
      (p.sku ?? "").toLowerCase().includes(lowerQuery)
  );
  const needsFixCount = matchingProducts.filter((p) => productIssues(p).length > 0).length;
  const filteredProducts = needsFix
    ? matchingProducts.filter((p) => productIssues(p).length > 0)
    : matchingProducts;

  const filterParams: Record<string, string> = {};
  if (query) filterParams.q = query;
  if (needsFix) filterParams.fix = "1";
  const toggleFixParams = new URLSearchParams(filterParams);
  if (needsFix) toggleFixParams.delete("fix");
  else toggleFixParams.set("fix", "1");
  const toggleFixQuery = toggleFixParams.toString();

  const sortedProducts = filteredProducts.sort((a, b) => {
    // In the "Needs fix" view, missing images come first — they're the
    // most visible gap on the storefront.
    if (needsFix) {
      const aImageRank = a.image_url ? 1 : 0;
      const bImageRank = b.image_url ? 1 : 0;
      if (aImageRank !== bImageRank) return aImageRank - bImageRank;
    }
    return b.updated_at.localeCompare(a.updated_at);
  });
  const count = sortedProducts.length;
  const storefrontCount = sortedProducts.filter((p) => storefrontProductIds.has(p.id)).length;
  const gradedCount = sortedProducts.filter(isSlabProduct).length;
  const boosterBoxCount = sortedProducts.filter(isBoosterBoxProduct).length;
  const etbCount = sortedProducts.filter(isEtbProduct).length;
  const singleCount = sortedProducts.filter(
    (p) => !isSlabProduct(p) && (p.tags ?? []).some((t) => t.toLowerCase() === "single")
  ).length;
  const otherCount = count - gradedCount - boosterBoxCount - etbCount - singleCount;
  const inStockCount = sortedProducts.filter((p) => (availableByProduct.get(p.id) ?? 0) > 0).length;
  const unitsAvailable = sortedProducts.reduce((sum, p) => sum + (availableByProduct.get(p.id) ?? 0), 0);
  // Listed on the storefront but nothing left to sell — worth a restock or
  // a restock ETA.
  const storefrontOosCount = sortedProducts.filter(
    (p) => storefrontProductIds.has(p.id) && (availableByProduct.get(p.id) ?? 0) === 0
  ).length;
  const preorderCount = sortedProducts.filter((p) => p.po_enabled).length;
  const pct = (n: number) => (count ? Math.round((n / count) * 100) : 0);
  const categories = [
    { label: "Graded cards", value: gradedCount, bar: "bg-violet-500" },
    { label: "Booster boxes", value: boosterBoxCount, bar: "bg-sky-500" },
    { label: "ETB", value: etbCount, bar: "bg-emerald-500" },
    { label: "Singles", value: singleCount, bar: "bg-amber-500" },
    { label: "Other", value: Math.max(0, otherCount), bar: "bg-gray-400" },
  ];
  const products = sortedProducts.slice(from, to + 1);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 lg:max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Products</h1>
        <Link href="/zlap-adm/products/new" className="rounded bg-black px-3 py-2 text-sm text-white">
          New product
        </Link>
      </div>
      <div className="mb-2 text-sm text-gray-500 lg:hidden">
        {count} products &middot; {storefrontCount} in storefront &middot; {gradedCount} graded &middot;{" "}
        {boosterBoxCount} booster boxes
      </div>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-6">
        <div>
          <form className="mb-4 flex gap-2">
            {needsFix && <input type="hidden" name="fix" value="1" />}
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search by name or SKU…"
              className="w-full rounded border px-3 py-2 text-sm"
            />
            <Link
              href={`/zlap-adm/products${toggleFixQuery ? `?${toggleFixQuery}` : ""}`}
              className={`shrink-0 rounded border px-3 py-2 text-sm whitespace-nowrap ${
                needsFix ? "border-amber-500 bg-amber-50 text-amber-800" : "hover:bg-gray-50"
              }`}
            >
              Needs fix ({needsFixCount})
            </Link>
          </form>
          <div className="divide-y rounded border">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/zlap-adm/products/${p.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-10 w-10 shrink-0 rounded border object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-gray-50 text-[9px] text-gray-400">
                      No image
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-gray-500">{p.sku}</div>
                    {productIssues(p).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {productIssues(p).map((issue) => (
                          <span
                            key={issue}
                            className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                          >
                            {issue}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {storefrontProductIds.has(p.id) && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Storefront
                    </span>
                  )}
                  {availableByProduct.get(p.id) ?? 0} available
                </div>
              </Link>
            ))}
            {products.length === 0 && (
              <div className="px-4 py-6 text-sm text-gray-500">
                {needsFix ? "Nothing needs fixing." : "No products yet."}
              </div>
            )}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={count ?? 0}
            basePath="/zlap-adm/products"
            extraParams={filterParams}
          />
        </div>
        <aside className="hidden flex-col gap-4 lg:sticky lg:top-6 lg:flex">
            {(query || needsFix) && (
              <div className="text-xs text-gray-500">
                Summary of the current{" "}
                {query ? <>search &ldquo;{query}&rdquo;</> : "filter"}
                {query && needsFix ? " (needs fix only)" : ""}
              </div>
            )}
            <div className="rounded border p-4">
              <div className="text-sm text-gray-500">Catalog</div>
              <div className="mt-1 text-3xl font-semibold">{count}</div>
              <div className="text-sm text-gray-500">products</div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-gray-500">In storefront</span>
                <span>
                  {storefrontCount}
                  <span className="ml-2 text-gray-400">
                    {pct(storefrontCount)}%
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{ width: `${pct(storefrontCount)}%` }}
                />
              </div>
            </div>
            <div className="rounded border p-4">
              <div className="text-sm text-gray-500">By category</div>
              <div className="mt-3 flex flex-col gap-3 text-sm">
                {categories.map((c) => (
                  <div key={c.label}>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{c.label}</span>
                      <span className="font-medium">{c.value}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${c.bar}`}
                        style={{ width: `${pct(c.value)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded border p-4">
              <div className="text-sm text-gray-500">Stock</div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xl font-semibold">{inStockCount}</div>
                  <div className="text-xs text-gray-500">in stock</div>
                </div>
                <div>
                  <div className="text-xl font-semibold">
                    {count - inStockCount}
                  </div>
                  <div className="text-xs text-gray-500">out of stock</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-gray-500">Units available</span>
                <span className="font-medium">{unitsAvailable}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-gray-500">Pre-orders open</span>
                <span className="font-medium">{preorderCount}</span>
              </div>
            </div>
            <div className="rounded border p-4">
              <div className="text-sm text-gray-500">Needs attention</div>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <Link
                  href={`/zlap-adm/products${toggleFixQuery ? `?${toggleFixQuery}` : ""}`}
                  className="flex items-center justify-between rounded px-2 py-1.5 -mx-2 hover:bg-gray-50"
                >
                  <span className="text-gray-600">
                    {needsFix ? "Showing needs fix" : "Missing catalog info"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      needsFixCount > 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {needsFixCount}
                  </span>
                </Link>
                <div className="flex items-center justify-between px-0 py-1.5">
                  <span className="text-gray-600">
                    In storefront, out of stock
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      storefrontOosCount > 0
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {storefrontOosCount}
                  </span>
                </div>
              </div>
            </div>
          </aside>
      </div>
    </div>
  );
}
