"use server";

import { createClient } from "@/lib/supabase/server";

export type Region = {
  code: string;
  name: string;
};

// Cascading address selects at checkout: pass null for the top-level list
// (provinces), then each level's selected code as the next level's parent.
export async function getRegionChildren(parentCode: string | null): Promise<Region[]> {
  const supabase = await createClient();
  let query = supabase.from("regions").select("code, name").order("name", { ascending: true });
  query = parentCode === null ? query.is("parent_code", null) : query.eq("parent_code", parentCode);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as Region[];
}
