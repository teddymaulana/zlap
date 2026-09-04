import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllUsedTags } from "@/lib/tags";
import { getCardSets } from "@/app/actions/sets";
import type { InventoryBatchAvailability, Product } from "@/lib/types";
import ProductHeaderForm from "./ProductHeaderForm";
import ProductBatches from "./ProductBatches";

function formatMoney(amount: number) {
  return `Rp. ${Math.round(amount || 0).toLocaleString("id-ID")}`;
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: product, error: productError },
    { data: batches, error: batchesError },
    { data: orderLines, error: orderLinesError },
    allTags,
    sets,
  ] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("inventory_batch_availability").select("*").eq("product_id", id),
    supabase.from("order_lines").select("price, inventory_batches(cost)").eq("product_id", id),
    getAllUsedTags(supabase),
    getCardSets(),
  ]);

  if (productError) throw new Error(productError.message);
  if (batchesError) throw new Error(batchesError.message);
  if (orderLinesError) throw new Error(orderLinesError.message);
  if (!product) notFound();

  // Older order lines (from before the Strapi migration — see
  // scripts/migrate.ts) can have no linked inventory batch, so their cost
  // is unknown. Treating that as zero cost would understate cost and
  // inflate net for any product with such lines, so instead estimate their
  // cost using this same product's own known cost ratio (from lines that do
  // have a linked batch), rather than silently pretending it was free.
  let knownRevenue = 0;
  let knownCost = 0;
  let unknownRevenue = 0;
  for (const l of orderLines ?? []) {
    const cost = (l.inventory_batches as unknown as { cost: number } | null)?.cost;
    if (cost === null || cost === undefined) {
      unknownRevenue += l.price ?? 0;
    } else {
      knownRevenue += l.price ?? 0;
      knownCost += cost;
    }
  }
  const hasUnknownCostLines = unknownRevenue > 0;
  const estimatedUnknownCost =
    hasUnknownCostLines && knownRevenue > 0 ? unknownRevenue * (knownCost / knownRevenue) : unknownRevenue;
  const allTimeRevenue = knownRevenue + unknownRevenue;
  const allTimeCost = knownCost + estimatedUnknownCost;
  const allTimeNet = allTimeRevenue - allTimeCost;

  const batchList = ((batches ?? []) as InventoryBatchAvailability[]).sort((a, b) => {
    const aHasStock = a.available > 0 ? 0 : 1;
    const bHasStock = b.available > 0 ? 0 : 1;
    if (aHasStock !== bHasStock) return aHasStock - bHasStock;
    return (b.acquired_date ?? "").localeCompare(a.acquired_date ?? "");
  });
  const totalAvailable = batchList.reduce((sum, b) => sum + Math.max(0, b.available), 0);
  const totalValue = batchList.reduce((sum, b) => sum + Math.max(0, b.available) * b.cost, 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <ProductHeaderForm product={product as Product} allTags={allTags} sets={sets} />
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Inventory batches</h2>
        <div className="flex gap-4 text-sm text-gray-600">
          <span>{totalAvailable} available</span>
          <span>{formatMoney(totalValue)}</span>
          <span>All time cost: {formatMoney(allTimeCost)}</span>
          <span>All time net: {formatMoney(allTimeNet)}</span>
        </div>
      </div>
      <ProductBatches productId={id} batches={batchList} />
    </div>
  );
}
