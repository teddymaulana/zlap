import { copy } from "@/lib/copy";

export default function RefundPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-lg font-semibold">{copy.refund.pageTitle}</h1>
      <p className="mb-8 text-sm text-gray-600">{copy.refund.intro}</p>

      <h2 className="mb-2 text-sm font-semibold text-black">{copy.refund.cancellationHeading}</h2>
      <p className="mb-8 text-sm text-gray-600">{copy.refund.cancellationBody}</p>

      <h2 className="mb-2 text-sm font-semibold text-black">{copy.refund.processHeading}</h2>
      <p className="mb-2 text-sm text-gray-600">{copy.refund.processIntro}</p>
      <ul className="mb-8 list-disc space-y-1 pl-5 text-sm text-gray-600">
        {copy.refund.processItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2 className="mb-2 text-sm font-semibold text-black">{copy.refund.stockHeading}</h2>
      <p className="mb-8 text-sm text-gray-600">{copy.refund.stockBody}</p>

      <p className="text-sm text-gray-600">{copy.refund.contactNote}</p>
    </div>
  );
}
