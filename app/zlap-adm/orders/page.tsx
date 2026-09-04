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

function PaymentBadge({ status }: { status: Order["payment_status"] }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${
        status === "paid"
          ? "bg-green-100 text-green-800"
          : status === "pending"
            ? "bg-yellow-100 text-yellow-800"
            : status === "refund_pending" || status === "refunded"
              ? "bg-red-100 text-red-800"
              : "bg-gray-100 text-gray-600"
      }`}
    >
      {formatStatus(status)}
    </span>
  );
}

function OrderList({ orders }: { orders: Order[] }) {
  return (
    <div className="divide-y rounded border">
      {orders.map((o) => (
        <Link
          key={o.id}
          href={`/zlap-adm/orders/${o.id}`}
          className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
        >
          <div>
            <div className="font-medium">{o.order_id}</div>
            <div className="text-sm text-gray-500">
              {o.channel} · {o.date}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PaymentBadge status={o.payment_status} />
            <div className="text-sm text-gray-600">{formatOrderStatus(o.status)}</div>
          </div>
        </Link>
      ))}
      {orders.length === 0 && <div className="px-4 py-6 text-sm text-gray-500">No orders yet.</div>}
    </div>
  );
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; storefrontPage?: string; q?: string }>;
}) {
  const { page: pageParam, storefrontPage: storefrontPageParam, q } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const storefrontPage = Math.max(1, Number(storefrontPageParam) || 1);
  const storefrontFrom = (storefrontPage - 1) * PAGE_SIZE;
  const storefrontTo = storefrontFrom + PAGE_SIZE - 1;

  const trimmedQuery = (q ?? "").trim();

  const supabase = await createClient();

  // Product-name matches are resolved to order ids up front so they can be
  // OR'd together with the order-id match in a single filter below — an order
  // matches the search if either its own id or one of its line items' product
  // name matches.
  let productMatchOrderIds: string[] = [];
  if (trimmedQuery) {
    const { data: matchingLines, error: linesError } = await supabase
      .from("order_lines")
      .select("order_id, products!inner(name)")
      .ilike("products.name", `%${trimmedQuery}%`);
    if (linesError) throw new Error(linesError.message);
    productMatchOrderIds = [...new Set((matchingLines ?? []).map((l) => l.order_id))];
  }

  // Raw PostgREST or() filters need their own escaping — quote the value and
  // escape backslashes/quotes so commas or parens in the search text can't
  // break the filter's mini-syntax.
  const escapedQuery = trimmedQuery.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const searchFilter = trimmedQuery
    ? [
        `order_id.ilike."%${escapedQuery}%"`,
        productMatchOrderIds.length > 0 ? `id.in.(${productMatchOrderIds.join(",")})` : null,
      ]
        .filter(Boolean)
        .join(",")
    : null;

  const [
    { data: orders, error, count },
    { data: storefrontOrders, error: storefrontError, count: storefrontCount },
  ] = await Promise.all([
    // Everything except storefront-auto-created orders (Tokopedia/Shopee/
    // direct sales entered manually, plus anything with no channel set).
    (() => {
      let query = supabase
        .from("orders")
        .select("*", { count: "exact" })
        // neq alone would also exclude rows where channel is null (three-valued
        // SQL logic), so null channels need to be let back in explicitly.
        .or("channel.neq.website,channel.is.null");
      if (searchFilter) query = query.or(searchFilter);
      return query.order("date", { ascending: false }).range(from, to);
    })(),
    // Auto-created by the storefront's own checkout (app/actions/checkout.ts
    // always inserts channel: "website") — kept in a separate table since
    // these need no manual review the way marketplace orders do.
    (() => {
      let query = supabase.from("orders").select("*", { count: "exact" }).eq("channel", "website");
      if (searchFilter) query = query.or(searchFilter);
      return query.order("date", { ascending: false }).range(storefrontFrom, storefrontTo);
    })(),
  ]);
  if (error) throw new Error(error.message);
  if (storefrontError) throw new Error(storefrontError.message);

  // Search always starts back at page 1 — carrying the other list's page
  // number forward would just be confusing once the result set has changed.
  const searchExtraParams: Record<string, string> = trimmedQuery ? { q: trimmedQuery } : {};

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Orders</h1>
        <Link href="/zlap-adm/orders/new" className="rounded bg-black px-3 py-2 text-sm text-white">
          New order
        </Link>
      </div>

      <form method="get" className="mb-6">
        <input
          type="search"
          name="q"
          defaultValue={trimmedQuery}
          placeholder="Search order number or product name"
          className="w-full max-w-sm rounded border px-3 py-2 text-sm"
        />
      </form>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div className="order-1 sm:order-2">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Storefront orders</h2>
          <OrderList orders={(storefrontOrders ?? []) as Order[]} />
          <Pagination
            page={storefrontPage}
            pageSize={PAGE_SIZE}
            totalCount={storefrontCount ?? 0}
            basePath="/zlap-adm/orders"
            paramName="storefrontPage"
            extraParams={searchExtraParams}
          />
        </div>

        <div className="order-2 sm:order-1">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Marketplace &amp; other orders</h2>
          <OrderList orders={(orders ?? []) as Order[]} />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={count ?? 0}
            basePath="/zlap-adm/orders"
            paramName="page"
            extraParams={searchExtraParams}
          />
        </div>
      </div>
    </div>
  );
}
