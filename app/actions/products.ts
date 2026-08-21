"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Batch changes live in a separate table, so they don't trip the products
// table's set_updated_at trigger on their own — touch the parent row so the
// products list' "sort by updated date" reflects batch activity too.
async function touchProduct(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string
) {
  await supabase
    .from("products")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", productId);
}

export async function createProduct(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const tags = formData.getAll("tags").map(String);

  if (!name) throw new Error("Name is required");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({ name, sku: sku || null, tags })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/products");
  redirect(`/products/${data.id}`);
}

export async function updateProduct(productId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const tags = formData.getAll("tags").map(String);

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ name, sku: sku || null, tags })
    .eq("id", productId);

  if (error) throw new Error(error.message);

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
}

export async function uploadProductImage(productId: string, formData: FormData) {
  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) return;

  const supabase = await createClient();
  const ext = file.name.split(".").pop();
  const path = `${productId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);

  const { error } = await supabase
    .from("products")
    .update({ image_url: data.publicUrl })
    .eq("id", productId);
  if (error) throw new Error(error.message);

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
}

export async function addInventoryBatch(productId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_batches").insert({
    product_id: productId,
    qty: 0,
    cost: 0,
    fee_pct: 18,
    add_up_pct: 15,
    acquired_date: new Date().toISOString().slice(0, 10),
    locked: false,
  });
  if (error) throw new Error(error.message);
  await touchProduct(supabase, productId);

  revalidatePath(`/products/${productId}`);
}

export async function updateInventoryBatch(
  productId: string,
  batchId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_batches")
    .update({
      qty: Number(formData.get("qty")) || 0,
      cost: Number(formData.get("cost")) || 0,
      fee_pct: Number(formData.get("fee_pct")) || 0,
      add_up_pct: Number(formData.get("add_up_pct")) || 0,
      acquired_date: String(formData.get("acquired_date") || "") || null,
      locked: formData.get("locked") === "on",
    })
    .eq("id", batchId);
  if (error) throw new Error(error.message);
  await touchProduct(supabase, productId);

  revalidatePath(`/products/${productId}`);
}

export async function deleteInventoryBatch(productId: string, batchId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_batches").delete().eq("id", batchId);
  if (error) throw new Error(error.message);
  await touchProduct(supabase, productId);

  revalidatePath(`/products/${productId}`);
}
