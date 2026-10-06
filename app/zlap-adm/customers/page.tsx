import Link from "next/link";
import { getCustomers } from "@/app/actions/adminCustomers";
import { PAGE_SIZE } from "@/lib/constants";
import Pagination from "@/app/Pagination";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { dateStyle: "medium" });
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const trimmedQuery = (q ?? "").trim();

  const { customers, totalCount } = await getCustomers(page, trimmedQuery);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Customers</h1>
        <span className="text-sm text-gray-500">{totalCount} accounts</span>
      </div>

      <form method="get" className="mb-6">
        <input
          type="search"
          name="q"
          defaultValue={trimmedQuery}
          placeholder="Search name, email or phone"
          className="w-full max-w-sm rounded border px-3 py-2 text-sm"
        />
      </form>

      <div className="divide-y rounded border">
        {customers.map((c) => (
          <Link
            key={c.id}
            href={`/zlap-adm/customers/${c.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
          >
            <div className="min-w-0">
              <div className="truncate font-medium">{c.name || "(no name)"}</div>
              <div className="truncate text-sm text-gray-500">
                {c.email}
                {c.phone && <span> · {c.phone}</span>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-sm text-gray-600">
              {!c.hasPassword && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">Google</span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  c.email_verified_at ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                }`}
              >
                {c.email_verified_at ? "Verified" : "Unverified"}
              </span>
              <span className="w-20 text-right">
                {c.orderCount} {c.orderCount === 1 ? "order" : "orders"}
              </span>
              <span className="hidden w-28 text-right text-gray-400 sm:inline">{formatDate(c.created_at)}</span>
            </div>
          </Link>
        ))}
        {customers.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-500">
            {trimmedQuery ? "No customers match this search." : "No customer accounts yet."}
          </div>
        )}
      </div>
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={totalCount}
        basePath="/zlap-adm/customers"
        extraParams={trimmedQuery ? { q: trimmedQuery } : {}}
      />
    </div>
  );
}
