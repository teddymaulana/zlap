import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { InventoryBatchAvailability, Order, OrderLine, Product } from "@/lib/types";
import OrderStatus from "./OrderStatus";
import OrderDate from "./OrderDate";
import OrderAwb from "./OrderAwb";
import OrderLines from "./OrderLines";
import OrderCheckoutLink from "./OrderCheckoutLink";
import OrderCustomer from "./OrderCustomer";
import CancellationPanel from "./CancellationPanel";
import DeleteOrderButton from "./DeleteOrderButton";

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
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{o.channel}</span>
            <OrderDate order={o} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatus order={o} />
          <DeleteOrderButton orderId={o.id} orderCode={o.order_id} />
        </div>
      </div>
      <OrderCustomer order={o} />
      <CancellationPanel order={o} />
      <OrderCheckoutLink order={o} lineCount={(lines ?? []).length} />
      <div className="mb-6 flex items-center justify-between gap-2">
        <OrderAwb order={o} />
        <a
          href={`/api/zlap-adm/orders/${o.id}/label`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
        >
          Print shipping label
        </a>
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
