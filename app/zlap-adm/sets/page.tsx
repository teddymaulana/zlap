import { getCardSets } from "@/app/actions/sets";
import SetManager from "./SetManager";

export default async function SetsPage() {
  const sets = await getCardSets();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Card sets</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage the set catalog used on the product form&apos;s Brand/Set fields.
        </p>
      </div>
      <SetManager sets={sets} />
    </div>
  );
}
