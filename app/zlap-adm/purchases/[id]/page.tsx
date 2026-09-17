import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Product, Purchase, PurchaseLine } from "@/lib/types";
import PurchaseHeaderForm from "./PurchaseHeaderForm";
import PurchaseLines from "./PurchaseLines";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: purchase, error: purchaseError },
    { data: lines, error: linesError },
    { data: products, error: productsError },
  ] = await Promise.all([
    supabase.from("purchases").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("purchase_lines")
      .select("*")
      .eq("purchase_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("products").select("*").order("name", { ascending: true }),
  ]);

  if (purchaseError) throw new Error(purchaseError.message);
  if (linesError) throw new Error(linesError.message);
  if (productsError) throw new Error(productsError.message);
  if (!purchase) notFound();

  const p = purchase as Purchase;
  const purchaseLines = (lines ?? []) as PurchaseLine[];
  const totalFees =
    p.inter_shipping + p.forwarding + p.local_cargo + p.payment_fee + p.other_expense - p.deduction;
  const totalItemCost = purchaseLines.reduce((sum, l) => sum + l.unit_cost * l.qty, 0);
  const totalQty = purchaseLines.reduce((sum, l) => sum + l.qty, 0);
  const grandTotal = totalItemCost + totalFees;

  const feeAllocationBase = purchaseLines
    .filter((l) => !l.exclude_cost && !l.use_custom_landed_cost)
    .reduce((sum, l) => sum + l.unit_cost * l.qty, 0);
  const netIncomeEstimate = purchaseLines.reduce((sum, l) => {
    const allocatedFee = l.exclude_cost
      ? 0
      : l.use_custom_landed_cost
        ? Number(l.custom_landed_cost) || 0
        : feeAllocationBase > 0
          ? Math.round((l.unit_cost / feeAllocationBase) * totalFees)
          : 0;
    const landedCost = l.unit_cost + allocatedFee;
    const marketEst = landedCost * 1.18;
    const defaultFinalPrice = marketEst * 1.1;
    return sum + (defaultFinalPrice - marketEst) * l.qty;
  }, 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">{p.name || "Purchase"}</h1>
      <PurchaseHeaderForm
        purchase={p}
        totalQty={totalQty}
        totalItemCost={totalItemCost}
        totalFees={totalFees}
        grandTotal={grandTotal}
        netIncomeEstimate={netIncomeEstimate}
      />
      <h2 className="mb-3 text-lg font-semibold">Lines</h2>
      <PurchaseLines
        purchaseId={id}
        products={(products ?? []) as Product[]}
        lines={purchaseLines}
        totalFees={totalFees}
      />
    </div>
  );
}
