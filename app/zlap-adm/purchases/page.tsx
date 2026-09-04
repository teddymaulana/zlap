import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Purchase } from "@/lib/types";
import { PAGE_SIZE } from "@/lib/constants";
import Pagination from "@/app/Pagination";

export default async function PurchasesPage({
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
    data: purchases,
    error,
    count,
  } = await supabase
    .from("purchases")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Purchases</h1>
        <Link href="/zlap-adm/purchases/new" className="rounded bg-black px-3 py-2 text-sm text-white">
          New purchase
        </Link>
      </div>
      <div className="divide-y rounded border">
        {((purchases ?? []) as Purchase[]).map((p) => (
          <Link
            key={p.id}
            href={`/zlap-adm/purchases/${p.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
          >
            <div className="font-medium">{p.name || "(untitled)"}</div>
            <div className="text-sm text-gray-500">{p.date}</div>
          </Link>
        ))}
        {purchases?.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-500">No purchases yet.</div>
        )}
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} totalCount={count ?? 0} basePath="/zlap-adm/purchases" />
    </div>
  );
}
