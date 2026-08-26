import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { InventoryBatchAvailability, Order, OrderLine, Product } from "@/lib/types";
import { formatStatus } from "@/lib/format";
import OrderStatus from "./OrderStatus";
import OrderAwb from "./OrderAwb";
import OrderLines from "./OrderLines";
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
          <div className="text-sm text-gray-500">
            {o.channel} · {o.date}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatus order={o} />
          <DeleteOrderButton orderId={o.id} orderCode={o.order_id} />
        </div>
      </div>
      {(o.customer_name || o.customer_email || o.customer_phone || o.customer_address) && (
        <div className="mb-6 rounded border p-4 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">Customer</span>
            <span className="flex items-center gap-2">
              {o.status === "cancelled" && (
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                  Cancelled
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  o.payment_status === "paid"
                    ? "bg-green-100 text-green-800"
                    : o.payment_status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : o.payment_status === "refund_pending" || o.payment_status === "refunded"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-600"
                }`}
              >
                {formatStatus(o.payment_status)}
                {o.payment_method ? ` · ${o.payment_method}` : ""}
              </span>
            </span>
          </div>
          {o.customer_name && <div>{o.customer_name}</div>}
          {o.customer_email && <div className="text-gray-600">{o.customer_email}</div>}
          {o.customer_phone && <div className="text-gray-600">{o.customer_phone}</div>}
          {o.customer_address && <div className="text-gray-600">{o.customer_address}</div>}
        </div>
      )}
      <CancellationPanel order={o} />
      <div className="mb-6">
        <OrderAwb order={o} />
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
