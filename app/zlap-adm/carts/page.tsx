import Link from "next/link";
import { getCartReport, type CartRange } from "@/app/actions/adminCarts";

const RANGES: { value: CartRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
}

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

export default async function CartsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams;
  const range: CartRange = RANGES.some((r) => r.value === rangeParam) ? (rangeParam as CartRange) : "today";
  const { adds, openCarts } = await getCartReport(range);
  const totalAdds = adds.reduce((sum, a) => sum + a.adds, 0);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Carts</h1>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <Link
              key={r.value}
              href={`/zlap-adm/carts?range=${r.value}`}
              className={`rounded border px-3 py-1.5 text-sm ${
                range === r.value ? "border-black bg-black text-white" : "text-gray-600 hover:border-gray-400"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-gray-700">
        Added to cart <span className="font-normal text-gray-500">({totalAdds} adds)</span>
      </h2>
      <div className="mb-10 divide-y rounded border">
        {adds.map((a) => (
          <div key={a.productId} className="flex items-center gap-3 px-4 py-3">
            {a.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.imageUrl} alt={a.name} className="h-10 w-10 shrink-0 rounded border object-cover" />
            ) : (
              <div className="h-10 w-10 shrink-0 rounded border bg-gray-50" />
            )}
            <Link href={`/zlap-adm/products/${a.productId}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
              {a.name}
            </Link>
            <div className="shrink-0 text-right">
              <div className="text-sm font-semibold">{a.adds}×</div>
              <div className="text-xs text-gray-500">
                {a.carts} {a.carts === 1 ? "cart" : "carts"}
                {a.preorderAdds > 0 && ` · ${a.preorderAdds} pre-order`}
              </div>
            </div>
          </div>
        ))}
        {adds.length === 0 && <div className="px-4 py-6 text-sm text-gray-500">Nothing added to a cart yet.</div>}
      </div>

      <h2 className="mb-1 text-sm font-semibold text-gray-700">
        Open carts <span className="font-normal text-gray-500">({openCarts.length})</span>
      </h2>
      <p className="mb-2 text-xs text-gray-500">Carts with items, changed in this period, with no order placed yet.</p>
      <div className="divide-y rounded border">
        {openCarts.map((c) => (
          <div key={c.id} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-sm font-medium">
                {c.customerId ? (
                  <Link href={`/zlap-adm/customers/${c.customerId}`} className="hover:underline">
                    {c.customerName || c.customerEmail}
                  </Link>
                ) : (
                  <span className="text-gray-500">Guest</span>
                )}
              </div>
              <div className="text-sm font-semibold">{formatMoney(c.subtotal)}</div>
            </div>
            <ul className="mt-1 text-xs text-gray-600">
              {c.items.map((i) => (
                <li key={i.id}>
                  {i.qty}× {i.name}
                  {i.isPreorder && <span className="text-gray-400"> (pre-order)</span>}
                </li>
              ))}
            </ul>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-400">
              <span>Updated {formatDate(c.updatedAt)}</span>
              {c.reminderSentAt && (
                <span className="text-green-700">Reminder sent {formatDate(c.reminderSentAt)}</span>
              )}
            </div>
          </div>
        ))}
        {openCarts.length === 0 && <div className="px-4 py-6 text-sm text-gray-500">No open carts.</div>}
      </div>
    </div>
  );
}
