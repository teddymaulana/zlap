"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CardSet } from "@/lib/types";

export async function getCardSets(): Promise<CardSet[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_sets")
    .select("*")
    .order("brand", { ascending: true })
    .order("language", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CardSet[];
}

export async function addCardSet(
  name: string,
  brand: "pokemon" | "one_piece",
  language: "en" | "jp" | "id"
) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Set name is required");

  const supabase = await createClient();
  const { error } = await supabase.from("card_sets").insert({ name: trimmed, brand, language });
  if (error) throw new Error(error.message);

  revalidatePath("/sets");
}

export async function removeCardSet(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("card_sets").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/sets");
}
