"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { BALANCE_CATEGORIES } from "@/lib/constants";

export async function createBalanceEntry(formData: FormData) {
  const date = String(formData.get("date") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!date) throw new Error("Date is required");
  if (type !== "in" && type !== "out") throw new Error("Type must be in or out");
  if (!amount || amount <= 0) throw new Error("Amount must be greater than 0");
  const isValidCategory = BALANCE_CATEGORIES.some((c) => c.value === category);
  if (category && !isValidCategory) throw new Error("Invalid category");

  const supabase = await createClient();
  const { error } = await supabase.from("balances").insert({
    date,
    type,
    category: category || null,
    amount,
    name: name || null,
    notes: notes || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/balance");
  revalidatePath("/dashboard");
}

export async function deleteBalanceEntry(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("balances").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/balance");
  revalidatePath("/dashboard");
}
