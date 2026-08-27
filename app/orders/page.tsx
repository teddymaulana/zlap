import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";
import { PAGE_SIZE } from "@/lib/constants";
import { formatStatus } from "@/lib/format";
import Pagination from "@/app/Pagination";

// "completed" reads as "Fulfilled" here — the underlying order.status value
// is unchanged (no migration needed), this is display-only.
function formatOrderStatus(status: string) {
  return status === "completed" ? "Fulfilled" : formatStatus(status);
}

function OrderList({ orders }: { orders: Order[] }) {
  return (
    <div className="divide-y rounded border">
      {orders.map((o) => (
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
          <div className="text-sm text-gray-600">{formatOrderStatus(o.status)}</div>
        </Link>
      ))}
      {orders.length === 0 && <div className="px-4 py-6 text-sm text-gray-500">No orders yet.</div>}
    </div>
  );
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; storefrontPage?: string }>;
}) {
  const { page: pageParam, storefrontPage: storefrontPageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const storefrontPage = Math.max(1, Number(storefrontPageParam) || 1);
  const storefrontFrom = (storefrontPage - 1) * PAGE_SIZE;
  const storefrontTo = storefrontFrom + PAGE_SIZE - 1;

  const supabase = await createClient();
  const [
    { data: orders, error, count },
    { data: storefrontOrders, error: storefrontError, count: storefrontCount },
  ] = await Promise.all([
    // Everything except storefront-auto-created orders (Tokopedia/Shopee/
    // direct sales entered manually, plus anything with no channel set).
    supabase
      .from("orders")
      .select("*", { count: "exact" })
      // neq alone would also exclude rows where channel is null (three-valued
      // SQL logic), so null channels need to be let back in explicitly.
      .or("channel.neq.website,channel.is.null")
      .order("date", { ascending: false })
      .range(from, to),
    // Auto-created by the storefront's own checkout (app/actions/checkout.ts
    // always inserts channel: "website") — kept in a separate table since
    // these need no manual review the way marketplace orders do.
    supabase
      .from("orders")
      .select("*", { count: "exact" })
      .eq("channel", "website")
      .order("date", { ascending: false })
      .range(storefrontFrom, storefrontTo),
  ]);
  if (error) throw new Error(error.message);
  if (storefrontError) throw new Error(storefrontError.message);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Orders</h1>
        <Link href="/orders/new" className="rounded bg-black px-3 py-2 text-sm text-white">
          New order
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div className="order-1 sm:order-2">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Storefront orders</h2>
          <OrderList orders={(storefrontOrders ?? []) as Order[]} />
          <Pagination
            page={storefrontPage}
            pageSize={PAGE_SIZE}
            totalCount={storefrontCount ?? 0}
            basePath="/orders"
            paramName="storefrontPage"
            extraParams={pageParam ? { page: pageParam } : {}}
          />
        </div>

        <div className="order-2 sm:order-1">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Marketplace &amp; other orders</h2>
          <OrderList orders={(orders ?? []) as Order[]} />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={count ?? 0}
            basePath="/orders"
            paramName="page"
            extraParams={storefrontPageParam ? { storefrontPage: storefrontPageParam } : {}}
          />
        </div>
      </div>
    </div>
  );
}
