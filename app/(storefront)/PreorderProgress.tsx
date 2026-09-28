import Link from "next/link";
import { addDays, daysUntil, poEta, PO_ESTIMATE_WEEKS, type PoProgress, type PoStage } from "@/lib/preorder";
import { courierName } from "@/lib/couriers";

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

const STEPS: { stage: PoStage; title: string }[] = [
  { stage: "buying", title: "Sourcing your item" },
  { stage: "bought", title: "Item secured" },
  { stage: "shipping", title: "Shipping to us" },
  { stage: "arrived", title: "Arrived with us" },
  { stage: "shipped_to_customer", title: "On its way to you" },
];
const ORDER: PoStage[] = ["ordered", "buying", "bought", "shipping", "arrived", "shipped_to_customer"];

// The pre-order half of a customer's order (Check your order page and the
// account order page). Server-safe: no hooks, so both pages can render it.
export default function PreorderProgress({ progress }: { progress: PoProgress }) {
  // "ordered" (not yet in a purchase) reads the same as "buying" to the
  // customer — either way we're sourcing it.
  const current = Math.max(ORDER.indexOf(progress.stage), ORDER.indexOf("buying"));
  const eta = poEta(progress);
  const totalDelay = progress.delays.reduce((sum, d) => sum + d.days, 0);

  const dateFor: Partial<Record<PoStage, string | null>> = {
    bought: progress.boughtAt,
    shipping: progress.shippedAt,
    arrived: progress.arrivedAt,
  };

  let headline: string;
  if (progress.stage === "shipped_to_customer") {
    headline = "Your pre-order is on its way to you.";
  } else if (progress.stage === "arrived") {
    headline = "Your pre-order has arrived with us — we're packing it now.";
  } else if (progress.stage === "shipping" && eta) {
    const left = daysUntil(eta);
    headline =
      left > 0
        ? `Arriving with us in about ${left} day${left === 1 ? "" : "s"} (est. ${formatDate(eta)}).`
        : `Due with us any day now (est. ${formatDate(eta)}).`;
  } else if (progress.orderedAt) {
    headline = `Estimated arrival: ${formatDate(addDays(progress.orderedAt, PO_ESTIMATE_WEEKS.min * 7))} – ${formatDate(
      addDays(progress.orderedAt, PO_ESTIMATE_WEEKS.max * 7)
    )}.`;
  } else {
    headline = `Usually arrives in about ${PO_ESTIMATE_WEEKS.min}–${PO_ESTIMATE_WEEKS.max} weeks.`;
  }

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/40 p-4 text-sm">
      <div className="mb-1 font-medium text-gray-900">Pre-order progress</div>
      <p className="mb-4 text-gray-700">{headline}</p>

      <ol>
        {STEPS.map((step, i) => {
          const index = ORDER.indexOf(step.stage);
          const done = index <= current;
          const isCurrent = index === current;
          const date = dateFor[step.stage];
          const last = i === STEPS.length - 1;
          return (
            <li key={step.stage} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && (
                <span
                  aria-hidden
                  className={`absolute top-3 left-[5px] h-full w-px ${index < current ? "bg-black" : "bg-gray-200"}`}
                />
              )}
              <span
                aria-hidden
                className={`relative mt-1 h-[11px] w-[11px] shrink-0 rounded-full ${
                  done ? "bg-black" : "border-2 border-gray-300 bg-white"
                }`}
              />
              <div className="min-w-0">
                <div className={done ? (isCurrent ? "font-medium text-gray-900" : "text-gray-700") : "text-gray-400"}>
                  {step.title}
                </div>
                {date && <div className="text-xs text-gray-400">{formatDate(date)}</div>}
                {step.stage === "shipping" && progress.delays.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {progress.delays.map((d, j) => (
                      <li key={j} className="text-xs text-orange-700">
                        Delayed {d.days} day{d.days === 1 ? "" : "s"}: {d.reason}
                      </li>
                    ))}
                  </ul>
                )}
                {step.stage === "shipping" && totalDelay > 0 && eta && (
                  <div className="text-xs text-gray-500">New estimate: {formatDate(eta)}</div>
                )}
                {step.stage === "shipped_to_customer" && progress.awb && (
                  <div className="mt-0.5 text-xs text-gray-600">
                    {courierName(progress.courier)} resi <span className="font-mono">{progress.awb}</span> ·{" "}
                    <Link href={`/track?awb=${encodeURIComponent(progress.awb)}`} className="text-black underline">
                      Track shipment
                    </Link>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
