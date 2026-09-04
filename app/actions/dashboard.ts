"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateMarketplaceBalances(formData: FormData) {
  const shopeeToSettle = Number(formData.get("shopee_to_settle")) || 0;
  const tokopediaToSettle = Number(formData.get("tokopedia_to_settle")) || 0;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("marketplace_balances")
    .select("id")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("marketplace_balances")
      .update({ shopee_to_settle: shopeeToSettle, tokopedia_to_settle: tokopediaToSettle })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("marketplace_balances").insert({
      shopee_to_settle: shopeeToSettle,
      tokopedia_to_settle: tokopediaToSettle,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/zlap-adm/dashboard");
}

export async function createSnapshot(formData: FormData) {
  const value = Number(formData.get("totalValue")) || 0;
  const deposit = Number(formData.get("depositToPay")) || 0;

  const supabase = await createClient();
  const { error } = await supabase.from("snapshots").insert({
    snapshot_date: new Date().toISOString().slice(0, 10),
    value,
    deposit,
    shopee: 0,
    tokopedia: 0,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/zlap-adm/charts");
  revalidatePath("/zlap-adm/dashboard");
}
