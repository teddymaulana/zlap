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

  revalidatePath("/zlap-adm/purchases");
  redirect(`/zlap-adm/purchases/${data.id}`);
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

  revalidatePath(`/zlap-adm/purchases/${purchaseId}`);
}

export async function addPurchaseLine(purchaseId: string, formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  const newProductName = String(formData.get("new_product_name") ?? "").trim();
  if (!productId && !newProductName) {
    throw new Error("Pick a product or enter a new product name");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("purchase_lines").insert({
    purchase_id: purchaseId,
    product_id: productId || null,
    new_product_name: productId ? null : newProductName,
    qty: Number(formData.get("qty")) || 0,
    unit_cost: Number(formData.get("unit_cost")) || 0,
    exclude_cost: formData.get("exclude_cost") === "on",
    use_custom_landed_cost: formData.get("use_custom_landed_cost") === "on",
    custom_landed_cost: formData.get("custom_landed_cost")
      ? Number(formData.get("custom_landed_cost"))
      : null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/zlap-adm/purchases/${purchaseId}`);
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

  revalidatePath(`/zlap-adm/purchases/${purchaseId}`);
}

export async function deletePurchaseLine(purchaseId: string, lineId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_lines")
    .delete()
    .eq("id", lineId)
    .eq("pushed", false);
  if (error) throw new Error(error.message);

  revalidatePath(`/zlap-adm/purchases/${purchaseId}`);
}

// Allocates the purchase's total shipping/handling fees across lines
// proportionally to unit_cost * qty, then creates one inventory batch per
// unpushed line. A line with no product_id yet (new_product_name set
// instead) gets its product created here first, and the line backfilled
// with the new product_id.
//
// Bulk pushes (onlyLineIds omitted) skip lines already pushed. A specific
// line passed via onlyLineIds is always processed, even if already pushed —
// that's a deliberate re-push, used when the purchase's fees changed after
// the first push and the already-created batch's cost needs recalculating.
async function pushLines(purchaseId: string, onlyLineIds?: string[]) {
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
    const isRepush = Boolean(onlyLineIds?.includes(line.id));
    if (onlyLineIds) {
      if (!isRepush) continue;
    } else if (line.pushed) {
      continue;
    }

    let allocatedFee = 0;
    if (!line.exclude_cost) {
      allocatedFee = line.use_custom_landed_cost
        ? Number(line.custom_landed_cost) || 0
        : totalItemCost > 0
          ? Math.round((line.unit_cost / totalItemCost) * totalFees)
          : 0;
    }
    const cost = line.unit_cost + allocatedFee;

    if (line.pushed && line.inventory_batch_id) {
      const { error: batchUpdateError } = await supabase
        .from("inventory_batches")
        .update({ cost })
        .eq("id", line.inventory_batch_id);
      if (batchUpdateError) throw new Error(batchUpdateError.message);
      continue;
    }

    let productId = line.product_id as string | null;
    if (!productId) {
      const { data: newProduct, error: productError } = await supabase
        .from("products")
        .insert({ name: line.new_product_name })
        .select("id")
        .single();
      if (productError) throw new Error(productError.message);
      productId = newProduct.id;
    }

    const { data: batch, error: batchError } = await supabase
      .from("inventory_batches")
      .insert({
        product_id: productId,
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
      .update({ product_id: productId, pushed: true, inventory_batch_id: batch.id })
      .eq("id", line.id);
    if (lineUpdateError) throw new Error(lineUpdateError.message);
  }

  revalidatePath(`/zlap-adm/purchases/${purchaseId}`);
  revalidatePath("/zlap-adm/products");
}

export async function pushToInventory(purchaseId: string) {
  await pushLines(purchaseId);
}

export async function pushPurchaseLine(purchaseId: string, lineId: string) {
  await pushLines(purchaseId, [lineId]);
}
