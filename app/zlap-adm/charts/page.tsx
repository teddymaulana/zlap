import { createClient } from "@/lib/supabase/server";
import type { Snapshot } from "@/lib/types";
import ZlapValueChart from "./ZlapValueChart";

export default async function ChartsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("snapshots")
    .select("*")
    .order("snapshot_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const snapshots = (data ?? []) as Snapshot[];
  // Zlap Value = total assets + marketplace balances not yet settled to the
  // bank − the amount owed back to the owner (each stored per snapshot row).
  const points = snapshots
    .filter((s) => s.value !== null)
    .map((s) => ({
      date: s.snapshot_date,
      value: (s.value ?? 0) + (s.shopee ?? 0) + (s.tokopedia ?? 0) - (s.deposit ?? 0),
    }));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">Charts</h1>
      <h2 className="mb-3 text-lg font-semibold">Zlap Value Chart</h2>
      <div className="rounded border p-4">
        <ZlapValueChart data={points} />
      </div>
    </div>
  );
}
