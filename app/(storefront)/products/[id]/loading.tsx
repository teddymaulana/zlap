import ZlapLoader from "@/app/ZlapLoader";
import { copy } from "@/lib/copy";

// Shown immediately on navigation to a PDP while its several parallel
// queries (product detail, recent sales, related/set products, discounts,
// gift catalog) resolve — without this, the previous page just sits there
// looking unresponsive for a couple of seconds after the click.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <ZlapLoader label={copy.common.loading} />
    </div>
  );
}
