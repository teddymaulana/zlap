"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createPurchase(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const date = String(formData.get("date") ?? "") || null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchases")
    .insert({ name: name || null, date })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/purchases");
  redirect(`/purchases/${data.id}`);
}

export async function updatePurchaseHeader(purchaseId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("purchases")
    .update({
      name: String(formData.get("name") ?? "").trim() || null,
      date: String(formData.get("date") ?? "") || null,
      inter_shipping: Number(formData.get("inter_shipping")) || 0,
      forwarding: Number(formData.get("forwarding")) || 0,
      local_cargo: Number(formData.get("local_cargo")) || 0,
      payment_fee: Number(formData.get("payment_fee")) || 0,
      other_expense: Number(formData.get("other_expense")) || 0,
      deduction: Number(formData.get("deduction")) || 0,
    })
    .eq("id", purchaseId);
  if (error) throw new Error(error.message);

  revalidatePath(`/purchases/${purchaseId}`);
}

export async function addPurchaseLine(purchaseId: string, formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  if (!productId) throw new Error("Pick a product first");

  const supabase = await createClient();
  const { error } = await supabase.from("purchase_lines").insert({
    purchase_id: purchaseId,
    product_id: productId,
    qty: Number(formData.get("qty")) || 0,
    unit_cost: Number(formData.get("unit_cost")) || 0,
    exclude_cost: formData.get("exclude_cost") === "on",
    use_custom_landed_cost: formData.get("use_custom_landed_cost") === "on",
    custom_landed_cost: formData.get("custom_landed_cost")
      ? Number(formData.get("custom_landed_cost"))
      : null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/purchases/${purchaseId}`);
}

export async function updatePurchaseLine(
  purchaseId: string,
  lineId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_lines")
    .update({
      qty: Number(formData.get("qty")) || 0,
      unit_cost: Number(formData.get("unit_cost")) || 0,
      exclude_cost: formData.get("exclude_cost") === "on",
      use_custom_landed_cost: formData.get("use_custom_landed_cost") === "on",
      custom_landed_cost: formData.get("custom_landed_cost")
        ? Number(formData.get("custom_landed_cost"))
        : null,
    })
    .eq("id", lineId)
    .eq("pushed", false);
  if (error) throw new Error(error.message);

  revalidatePath(`/purchases/${purchaseId}`);
}

export async function deletePurchaseLine(purchaseId: string, lineId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_lines")
    .delete()
    .eq("id", lineId)
    .eq("pushed", false);
  if (error) throw new Error(error.message);

  revalidatePath(`/purchases/${purchaseId}`);
}

// Allocates the purchase's total shipping/handling fees across lines
// proportionally to unit_cost * qty, then creates one inventory batch per
// unpushed line. Lines already pushed are left untouched (idempotent).
export async function pushToInventory(purchaseId: string) {
  const supabase = await createClient();

  const [{ data: purchase, error: purchaseError }, { data: lines, error: linesError }] =
    await Promise.all([
      supabase.from("purchases").select("*").eq("id", purchaseId).single(),
      supabase.from("purchase_lines").select("*").eq("purchase_id", purchaseId),
    ]);
  if (purchaseError) throw new Error(purchaseError.message);
  if (linesError) throw new Error(linesError.message);
  if (!lines || lines.length === 0) return;

  const totalFees =
    purchase.inter_shipping +
    purchase.forwarding +
    purchase.local_cargo +
    purchase.payment_fee +
    purchase.other_expense -
    purchase.deduction;

  const totalItemCost = lines
    .filter((l) => !l.exclude_cost && !l.use_custom_landed_cost)
    .reduce((sum, l) => sum + l.unit_cost * l.qty, 0);

  const acquiredDate = purchase.date ?? new Date().toISOString().slice(0, 10);

  for (const line of lines) {
    if (line.pushed) continue;

    let allocatedFee = 0;
    if (!line.exclude_cost) {
      allocatedFee = line.use_custom_landed_cost
        ? Number(line.custom_landed_cost) || 0
        : totalItemCost > 0
          ? Math.round((line.unit_cost / totalItemCost) * totalFees)
          : 0;
    }
    const cost = line.unit_cost + allocatedFee;

    const { data: batch, error: batchError } = await supabase
      .from("inventory_batches")
      .insert({
        product_id: line.product_id,
        qty: line.qty,
        cost,
        acquired_date: acquiredDate,
        purchase_id: purchaseId,
      })
      .select("id")
      .single();
    if (batchError) throw new Error(batchError.message);

    const { error: lineUpdateError } = await supabase
      .from("purchase_lines")
      .update({ pushed: true, inventory_batch_id: batch.id })
      .eq("id", line.id);
    if (lineUpdateError) throw new Error(lineUpdateError.message);
  }

  revalidatePath(`/purchases/${purchaseId}`);
  revalidatePath("/products");
}
