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
  const totalFees =
    p.inter_shipping + p.forwarding + p.local_cargo + p.payment_fee + p.other_expense - p.deduction;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">{p.name || "Purchase"}</h1>
      <PurchaseHeaderForm purchase={p} />
      <h2 className="mb-3 text-lg font-semibold">Lines</h2>
      <PurchaseLines
        purchaseId={id}
        products={(products ?? []) as Product[]}
        lines={(lines ?? []) as PurchaseLine[]}
        totalFees={totalFees}
      />
    </div>
  );
}
