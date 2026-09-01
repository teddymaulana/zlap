"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
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

// For the storefront's Sets filter — only sets that currently have at least
// one product with storefront stock, so shoppers can't pick a set and land
// on an empty result. Admin pages (adding/editing a product, /sets) still
// use getCardSets() since they need every set, stocked or not.
export async function getCardSetsInStock(): Promise<CardSet[]> {
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: batches, error: batchesError } = await service
    .from("inventory_batch_availability")
    .select("product_id")
    .eq("is_storefront_price", true)
    .gt("storefront_available", 0);
  if (batchesError) throw new Error(batchesError.message);

  const productIds = [...new Set((batches ?? []).map((b) => b.product_id))];
  if (productIds.length === 0) return [];

  const supabase = await createClient();
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("set_id")
    .in("id", productIds);
  if (productsError) throw new Error(productsError.message);

  const setIds = new Set(
    (products ?? []).map((p) => p.set_id).filter((id): id is string => !!id)
  );
  if (setIds.size === 0) return [];

  const allSets = await getCardSets();
  return allSets.filter((s) => setIds.has(s.id));
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
