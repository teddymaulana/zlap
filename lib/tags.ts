import type { createClient } from "@/lib/supabase/server";

// Every tag currently used across all products, so a custom tag typed once
// (e.g. "luffy") shows up as a suggestion on other products afterward.
export async function getAllUsedTags(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string[]> {
  const { data } = await supabase.from("products").select("tags");
  const all = new Set<string>();
  for (const row of data ?? []) {
    for (const t of (row.tags as string[] | null) ?? []) all.add(t);
  }
  return [...all].sort();
}
