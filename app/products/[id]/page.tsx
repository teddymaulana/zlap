import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const [{ data: product, error: productError }, { data: batches, error: batchesError }] =
    await Promise.all([
      supabase.from("products").select("*").eq("id", id).maybeSingle(),
      supabase.from("inventory_batch_availability").select("*").eq("product_id", id),
    ]);

  if (productError) throw new Error(productError.message);
  if (batchesError) throw new Error(batchesError.message);
  if (!product) notFound();

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
      <ProductHeaderForm product={product as Product} />
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Inventory batches</h2>
        <div className="flex gap-4 text-sm text-gray-600">
          <span>{totalAvailable} available</span>
          <span>{formatMoney(totalValue)}</span>
        </div>
      </div>
      <ProductBatches productId={id} batches={batchList} />
    </div>
  );
}
