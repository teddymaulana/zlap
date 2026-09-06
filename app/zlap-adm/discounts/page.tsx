import Link from "next/link";
import { getDiscounts } from "@/app/actions/discounts";
import { createClient } from "@/lib/supabase/server";
import DiscountRowActions from "./DiscountRowActions";

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

function summarize(
  discount: Awaited<ReturnType<typeof getDiscounts>>[number],
  productNameById: Map<string, string>
) {
  if (discount.type === "percentage") return `${discount.percentage}% off`;
  if (discount.type === "fixed") return `${formatMoney(discount.fixedAmount ?? 0)} off`;
  const freeName = discount.freeProductId ? productNameById.get(discount.freeProductId) : null;
  return `Buy one, get ${freeName ?? "item"} free`;
}

export default async function DiscountsPage() {
  const discounts = await getDiscounts();

  const supabase = await createClient();
  const productIds = [
    ...new Set(discounts.flatMap((d) => [...d.productIds, d.freeProductId].filter((id): id is string => Boolean(id)))),
  ];
  const { data: products } = productIds.length
    ? await supabase.from("products").select("id, name").in("id", productIds)
    : { data: [] };
  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Discounts</h1>
        <Link href="/zlap-adm/discounts/new" className="rounded bg-black px-3 py-2 text-sm text-white">
          New discount
        </Link>
      </div>
      <div className="divide-y rounded border">
        {discounts.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <Link href={`/zlap-adm/discounts/${d.id}`} className="truncate text-sm font-medium hover:underline">
                {d.name}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                <span>{summarize(d, productNameById)}</span>
                <span>·</span>
                <span>
                  {d.productIds.length === 0 && d.code
                    ? "Whole cart"
                    : `${d.productIds.length} product${d.productIds.length === 1 ? "" : "s"}`}
                </span>
                {d.code && (
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-blue-700">
                    {d.code}
                  </span>
                )}
                {d.stackable && <span>· Stackable</span>}
                {d.oncePerCustomer ? (
                  <span>· Once per customer</span>
                ) : (
                  d.requiresLogin && <span>· Login required</span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  d.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}
              >
                {d.isActive ? "Active" : "Inactive"}
              </span>
              <DiscountRowActions discountId={d.id} discountName={d.name} isActive={d.isActive} />
            </div>
          </div>
        ))}
        {discounts.length === 0 && <div className="px-4 py-6 text-sm text-gray-500">No discounts yet.</div>}
      </div>
    </div>
  );
}
