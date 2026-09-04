import { createClient } from "@/lib/supabase/server";
import type { Balance } from "@/lib/types";
import { BALANCE_CATEGORIES, PAGE_SIZE } from "@/lib/constants";
import Pagination from "@/app/Pagination";
import { createBalanceEntry, deleteBalanceEntry } from "@/app/actions/balance";

function categoryLabel(category: Balance["category"]) {
  return BALANCE_CATEGORIES.find((c) => c.value === category)?.label ?? null;
}

function formatMoney(amount: number) {
  return `Rp. ${Math.round(amount || 0).toLocaleString("id-ID")}`;
}

export default async function BalancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const [
    {
      data: entries,
      error,
      count,
    },
    { data: allEntries, error: allError },
  ] = await Promise.all([
    supabase
      .from("balances")
      .select("*", { count: "exact" })
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to),
    supabase
      .from("balances")
      .select("type, amount, date, created_at")
      .order("date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  if (error) throw new Error(error.message);
  if (allError) throw new Error(allError.message);

  // The summary boxes exclude the very first entry ever recorded (the
  // beginning-balance seed row) — it isn't a period movement in/out.
  const summaryEntries = (
    (allEntries ?? []) as Pick<Balance, "type" | "amount" | "date" | "created_at">[]
  ).slice(1);

  const totalIncome = summaryEntries
    .filter((b) => b.type !== "out")
    .reduce((sum, b) => sum + b.amount, 0);
  const totalOutcome = summaryEntries
    .filter((b) => b.type === "out")
    .reduce((sum, b) => sum + b.amount, 0);
  const currentBalance = totalIncome - totalOutcome;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">Balance</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded border p-4">
          <div className="text-sm text-gray-500">Current balance</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoney(currentBalance)}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-gray-500">Total income</div>
          <div className="mt-1 text-2xl font-semibold text-green-600">
            {formatMoney(totalIncome)}
          </div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-gray-500">Total outcome</div>
          <div className="mt-1 text-2xl font-semibold text-red-600">
            {formatMoney(totalOutcome)}
          </div>
        </div>
      </div>

      <form
        action={createBalanceEntry}
        className="mb-8 grid grid-cols-2 gap-3 rounded border p-4 sm:grid-cols-3 lg:grid-cols-6 sm:items-end"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="date" className="text-sm font-medium">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="rounded border px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="type" className="text-sm font-medium">
            Type
          </label>
          <select id="type" name="type" required className="rounded border px-2 py-1.5 text-sm">
            <option value="in">Income</option>
            <option value="out">Outcome</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="category" className="text-sm font-medium">
            Category
          </label>
          <select id="category" name="category" className="rounded border px-2 py-1.5 text-sm">
            <option value="">—</option>
            {BALANCE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="amount" className="text-sm font-medium">
            Amount
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            min={0}
            step="0.01"
            required
            className="rounded border px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium">
            Description
          </label>
          <input id="name" name="name" className="rounded border px-2 py-1.5 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="notes" className="text-sm font-medium">
            Notes
          </label>
          <input id="notes" name="notes" className="rounded border px-2 py-1.5 text-sm" />
        </div>
        <button
          type="submit"
          className="col-span-2 rounded bg-black px-3 py-2 text-sm text-white sm:col-span-3 lg:col-span-6"
        >
          Add entry
        </button>
      </form>

      <div className="divide-y rounded border">
        {((entries ?? []) as Balance[]).map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <div className="font-medium">
                {b.name || "(no description)"}{" "}
                <span
                  className={
                    b.type === "out" ? "text-sm text-red-600" : "text-sm text-green-600"
                  }
                >
                  {b.type === "out" ? "outcome" : "income"}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {b.date}
                {categoryLabel(b.category) ? ` · ${categoryLabel(b.category)}` : ""}
                {b.notes ? ` · ${b.notes}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium">
                {b.type === "out" ? "-" : "+"}
                {formatMoney(b.amount)}
              </div>
              <form action={deleteBalanceEntry.bind(null, b.id)}>
                <button type="submit" className="text-sm text-red-600 hover:underline">
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
        {entries?.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-500">No balance entries yet.</div>
        )}
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} totalCount={count ?? 0} basePath="/zlap-adm/balance" />
    </div>
  );
}
