import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { InventoryBatchAvailability, Order, OrderLine, Product } from "@/lib/types";
import OrderStatus from "./OrderStatus";
import OrderLines from "./OrderLines";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: order, error: orderError },
    { data: lines, error: linesError },
    { data: products, error: productsError },
    { data: batches, error: batchesError },
  ] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_lines").select("*").eq("order_id", id).order("created_at", { ascending: true }),
    supabase.from("products").select("*").order("name", { ascending: true }),
    supabase.from("inventory_batch_availability").select("*"),
  ]);

  if (orderError) throw new Error(orderError.message);
  if (linesError) throw new Error(linesError.message);
  if (productsError) throw new Error(productsError.message);
  if (batchesError) throw new Error(batchesError.message);
  if (!order) notFound();

  const o = order as Order;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{o.order_id}</h1>
          <div className="text-sm text-gray-500">
            {o.channel} · {o.date}
          </div>
        </div>
        <OrderStatus order={o} />
      </div>
      <OrderLines
        orderId={id}
        products={(products ?? []) as Product[]}
        batches={(batches ?? []) as InventoryBatchAvailability[]}
        lines={(lines ?? []) as OrderLine[]}
      />
    </div>
  );
}
