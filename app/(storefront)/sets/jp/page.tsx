import type { Metadata } from "next";
import { getJpFeaturedSets, type JpSet } from "@/app/actions/storefront";
import SetCard from "./SetCard";

export const metadata: Metadata = {
  title: "Shop by set — Japanese sets | ZLAP Cards",
  description:
    "Booster boxes from every Japanese Pokémon expansion ZLAP Cards carries, newest release first.",
};

// Groups sets by era (falling back to a single "Other sets" bucket for any
// with no era set) and orders the eras themselves by each one's newest
// release — so as a new era's sets get added, that era's heading
// automatically floats above older ones instead of needing to be
// reordered by hand.
function groupByEra(sets: JpSet[]): { era: string; sets: JpSet[] }[] {
  const buckets = new Map<string, JpSet[]>();
  for (const set of sets) {
    const key = set.era ?? "Other sets";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(set);
    else buckets.set(key, [set]);
  }
  return [...buckets.entries()]
    .map(([era, eraSets]) => ({ era, sets: eraSets }))
    .sort((a, b) => (b.sets[0]?.releasedAt ?? "").localeCompare(a.sets[0]?.releasedAt ?? ""));
}

export default async function JapaneseSetsPage() {
  const sets = await getJpFeaturedSets();
  const eras = groupByEra(sets);

  return (
    <div className="min-h-screen bg-[#f6f6f4] px-4 pt-10 pb-24 text-[#14100a]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[#e3e2dd] pb-[22px]">
          <div className="flex flex-col gap-2.5">
            <p className="text-[11px] font-bold tracking-[0.18em] text-[#1f7a3d] uppercase">
              Japanese sets
            </p>
            <h1 className="font-[family-name:var(--font-anton)] text-[46px] leading-none tracking-[0.01em]">
              SHOP BY SET
            </h1>
            <p className="max-w-[520px] text-sm leading-relaxed text-[#5c5a53] text-pretty">
              Booster boxes from every Japanese expansion we carry, newest release first.
            </p>
          </div>
          <p className="text-xs font-bold tracking-[0.1em] text-[#5e5c54] uppercase">{sets.length} sets</p>
        </header>

        {eras.map(({ era, sets: eraSets }) => (
          <div key={era} className="flex flex-col gap-6">
            <h2 className="font-[family-name:var(--font-anton)] text-2xl tracking-[0.01em]">{era}</h2>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {eraSets.map((set) => (
                <SetCard key={set.productId} set={set} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
