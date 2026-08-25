import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";
import { PAGE_SIZE } from "@/lib/constants";
import { formatStatus } from "@/lib/format";
import Pagination from "@/app/Pagination";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const {
    data: orders,
    error,
    count,
  } = await supabase
    .from("orders")
    .select("*", { count: "exact" })
    .order("date", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Orders</h1>
        <Link href="/orders/new" className="rounded bg-black px-3 py-2 text-sm text-white">
          New order
        </Link>
      </div>
      <div className="divide-y rounded border">
        {((orders ?? []) as Order[]).map((o) => (
          <Link
            key={o.id}
            href={`/orders/${o.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
          >
            <div>
              <div className="font-medium">{o.order_id}</div>
              <div className="text-sm text-gray-500">
                {o.channel} · {o.date}
              </div>
            </div>
            <div className="text-sm text-gray-600">{formatStatus(o.status)}</div>
          </Link>
        ))}
        {orders?.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-500">No orders yet.</div>
        )}
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} totalCount={count ?? 0} basePath="/orders" />
    </div>
  );
}
