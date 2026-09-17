import ZlapLoader from "@/app/ZlapLoader";
import { copy } from "@/lib/copy";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <ZlapLoader label={copy.common.loading} />
    </div>
  );
}
