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
  const brand = String(formData.get("brand") ?? "").trim();
  const setId = String(formData.get("set_id") ?? "").trim();

  if (!name) throw new Error("Name is required");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({ name, sku: sku || null, tags, brand: brand || null, set_id: setId || null })
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
  const brand = String(formData.get("brand") ?? "").trim();
  const setId = String(formData.get("set_id") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ name, sku: sku || null, tags, brand: brand || null, set_id: setId || null })
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
      direct_price: formData.get("direct_price") ? Number(formData.get("direct_price")) : null,
      is_preorder: formData.get("is_preorder") === "on",
      preorder_duration_days: formData.get("preorder_duration_days")
        ? Number(formData.get("preorder_duration_days"))
        : null,
      preorder_arrival_date: String(formData.get("preorder_arrival_date") || "") || null,
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

// Only one batch per product can be the storefront price source. Clicking
// the already-selected batch clears the selection; clicking another batch
// unsets the previous one and selects it instead.
export async function setStorefrontPriceBatch(
  productId: string,
  batchId: string,
  currentlySelected: boolean
) {
  const supabase = await createClient();

  const { error: unsetError } = await supabase
    .from("inventory_batches")
    .update({ is_storefront_price: false })
    .eq("product_id", productId);
  if (unsetError) throw new Error(unsetError.message);

  if (!currentlySelected) {
    const { error } = await supabase
      .from("inventory_batches")
      .update({ is_storefront_price: true })
      .eq("id", batchId);
    if (error) throw new Error(error.message);
  }

  await touchProduct(supabase, productId);
  revalidatePath(`/products/${productId}`);
}

type FeaturedSection = "featured_section_1" | "featured_section_2";

export async function setProductFeatured(
  productId: string,
  section: FeaturedSection,
  value: boolean
) {
  const supabase = await createClient();
  const orderColumn = `${section}_order`;

  if (value) {
    // Append to the end of the section's current order.
    const { data: maxRow, error: maxError } = await supabase
      .from("products")
      .select(orderColumn)
      .eq(section, true)
      .order(orderColumn, { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxError) throw new Error(maxError.message);
    const nextOrder = ((maxRow as Record<string, number | null> | null)?.[orderColumn] ?? -1) + 1;

    const { error } = await supabase
      .from("products")
      .update({ [section]: true, [orderColumn]: nextOrder })
      .eq("id", productId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("products")
      .update({ [section]: false, [orderColumn]: null })
      .eq("id", productId);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/storefront");
  revalidatePath("/store");
}

export async function updateSectionTitle(sectionId: FeaturedSection, title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title is required");

  const supabase = await createClient();
  const { error } = await supabase
    .from("storefront_sections")
    .update({ title: trimmed })
    .eq("id", sectionId);
  if (error) throw new Error(error.message);

  revalidatePath("/storefront");
  revalidatePath("/store");
}

export async function addPopularKeyword(keyword: string) {
  const trimmed = keyword.trim();
  if (!trimmed) throw new Error("Keyword is required");

  const supabase = await createClient();
  const { error } = await supabase.from("popular_keywords").insert({ keyword: trimmed });
  if (error) throw new Error(error.message);

  revalidatePath("/storefront");
  revalidatePath("/store");
}

export async function removePopularKeyword(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("popular_keywords").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/storefront");
  revalidatePath("/store");
}

export async function reorderFeaturedProduct(
  productId: string,
  section: FeaturedSection,
  direction: "up" | "down"
) {
  const supabase = await createClient();
  const orderColumn = `${section}_order`;

  const { data: rows, error } = await supabase
    .from("products")
    .select("id, featured_section_1_order, featured_section_2_order")
    .eq(section, true)
    .order(orderColumn, { ascending: true });
  if (error) throw new Error(error.message);

  const list = (rows ?? []) as unknown as Record<string, string | number>[];
  const index = list.findIndex((r) => r.id === productId);
  if (index === -1) return;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= list.length) return;

  const a = list[index];
  const b = list[swapIndex];

  const { error: err1 } = await supabase
    .from("products")
    .update({ [orderColumn]: b[orderColumn] })
    .eq("id", a.id);
  if (err1) throw new Error(err1.message);
  const { error: err2 } = await supabase
    .from("products")
    .update({ [orderColumn]: a[orderColumn] })
    .eq("id", b.id);
  if (err2) throw new Error(err2.message);

  revalidatePath("/storefront");
  revalidatePath("/store");
}
