import { copy } from "@/lib/copy";

export default function FaqPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="mb-4 text-lg font-semibold">{copy.footer.faq}</h1>
      <p className="text-sm text-gray-600">{copy.footer.comingSoonBody}</p>
    </div>
  );
}
