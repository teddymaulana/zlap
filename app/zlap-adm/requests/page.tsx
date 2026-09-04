import { getCardRequests } from "@/app/actions/adminCardRequests";
import { formatStatus } from "@/lib/format";
import RequestActions from "./RequestActions";

function formatMoney(amount: number | null) {
  if (amount === null) return "—";
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

function badgeClass(status: string) {
  if (status === "quoted") return "bg-blue-100 text-blue-800";
  if (status === "completed") return "bg-green-100 text-green-800";
  if (status === "rejected" || status === "expired") return "bg-gray-100 text-gray-600";
  return "bg-yellow-100 text-yellow-800";
}

export default async function RequestsPage() {
  const requests = await getCardRequests();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">Card requests</h1>
      <div className="divide-y rounded border">
        {requests.map((r) => (
          <div key={r.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {[r.card_name, r.set_name, r.grade].filter(Boolean).join(" — ")}
              </div>
              <div className="text-xs text-gray-500">
                {r.customer_name || "Guest"} · {r.customer_email}
                {r.customer_phone ? ` · ${r.customer_phone}` : ""} · Qty {r.qty}
              </div>
              {(r.reference_url || r.notes) && (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                  {r.reference_url && (
                    <a
                      href={r.reference_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Customer reference link
                    </a>
                  )}
                  {r.notes && <span className="text-gray-500">{r.notes}</span>}
                </div>
              )}
              {r.status !== "pending" && (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                  <span className="font-semibold tabular-nums text-gray-900">
                    Quoted {formatMoney(r.quoted_price)}
                  </span>
                  {r.snkrdunk_url && (
                    <a
                      href={r.snkrdunk_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      SNKRDUNK ref
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass(r.status)}`}>
                {formatStatus(r.status)}
              </span>
              {r.status === "pending" && <RequestActions requestId={r.id} />}
            </div>
          </div>
        ))}
        {requests.length === 0 && <div className="px-4 py-6 text-sm text-gray-500">No requests yet.</div>}
      </div>
    </div>
  );
}
