"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { StorefrontSettings, StorefrontShortcutBadge } from "@/lib/types";

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

  revalidatePath("/zlap-adm/products");
  redirect(`/zlap-adm/products/${data.id}`);
}

export async function updateProduct(productId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const tags = formData.getAll("tags").map(String);
  const brand = String(formData.get("brand") ?? "").trim();
  const setId = String(formData.get("set_id") ?? "").trim();
  const offersEnabled = formData.get("offers_enabled") === "on";
  const offerMinPriceRaw = String(formData.get("offer_min_price") ?? "").trim();
  const offerMinPrice = offerMinPriceRaw ? Number(offerMinPriceRaw) : null;
  const showWhenOos = formData.get("show_when_oos") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name,
      sku: sku || null,
      tags,
      brand: brand || null,
      set_id: setId || null,
      offers_enabled: offersEnabled,
      offer_min_price: offerMinPrice,
      show_when_oos: showWhenOos,
    })
    .eq("id", productId);

  if (error) throw new Error(error.message);

  revalidatePath(`/zlap-adm/products/${productId}`);
  revalidatePath("/zlap-adm/products");
  revalidatePath("/");
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

  revalidatePath(`/zlap-adm/products/${productId}`);
  revalidatePath("/zlap-adm/products");
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

  revalidatePath(`/zlap-adm/products/${productId}`);
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
      storefront_qty_limit: formData.get("storefront_qty_limit")
        ? Number(formData.get("storefront_qty_limit"))
        : null,
    })
    .eq("id", batchId);
  if (error) throw new Error(error.message);
  await touchProduct(supabase, productId);

  revalidatePath(`/zlap-adm/products/${productId}`);
}

export async function deleteInventoryBatch(productId: string, batchId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_batches").delete().eq("id", batchId);
  if (error) throw new Error(error.message);
  await touchProduct(supabase, productId);

  revalidatePath(`/zlap-adm/products/${productId}`);
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
  revalidatePath(`/zlap-adm/products/${productId}`);
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
    // Append to the end of the section's current order. Computed in JS
    // (rather than "order by X desc limit 1") because a legacy row with a
    // null order — from before per-section ordering existed — sorts before
    // real values in descending order in Postgres, which would make every
    // new addition collide back at order 0 instead of appending.
    const { data: rows, error: rowsError } = await supabase
      .from("products")
      .select(orderColumn)
      .eq(section, true);
    if (rowsError) throw new Error(rowsError.message);
    const maxOrder = ((rows ?? []) as unknown as Record<string, number | null>[]).reduce(
      (max, r) => Math.max(max, r[orderColumn] ?? -1),
      -1
    );
    const nextOrder = maxOrder + 1;

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

  revalidatePath("/zlap-adm/storefront");
  revalidatePath("/");
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

  revalidatePath("/zlap-adm/storefront");
  revalidatePath("/");
}

export async function getStorefrontSettings(): Promise<StorefrontSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("storefront_settings").select("*").eq("id", 1).single();
  if (error) throw new Error(error.message);
  return data as StorefrontSettings;
}

export async function updateStorefrontSettings(headerTagline: string, announcementText: string) {
  const trimmedTagline = headerTagline.trim();
  if (!trimmedTagline) throw new Error("Header tagline is required");

  // One message per line in the admin textarea; blank lines dropped.
  const messages = announcementText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (messages.length === 0) throw new Error("At least one announcement message is required");

  const supabase = await createClient();
  const { error } = await supabase
    .from("storefront_settings")
    .update({ header_tagline: trimmedTagline, announcement_messages: messages })
    .eq("id", 1);
  if (error) throw new Error(error.message);

  revalidatePath("/zlap-adm/storefront");
  // "layout" since the header/announcement bar render from the shared
  // / layout, not just the / homepage.
  revalidatePath("/", "layout");
}

export async function addPopularKeyword(keyword: string) {
  const trimmed = keyword.trim();
  if (!trimmed) throw new Error("Keyword is required");

  const supabase = await createClient();
  const { error } = await supabase.from("popular_keywords").insert({ keyword: trimmed });
  if (error) throw new Error(error.message);

  revalidatePath("/zlap-adm/storefront");
  revalidatePath("/");
}

export async function removePopularKeyword(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("popular_keywords").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/zlap-adm/storefront");
  revalidatePath("/");
}

export async function addStorefrontShortcut(
  label: string,
  href: string,
  badge: StorefrontShortcutBadge | null = null
) {
  const trimmedLabel = label.trim();
  const trimmedHref = href.trim();
  if (!trimmedLabel) throw new Error("Label is required");
  if (!trimmedHref) throw new Error("Link is required");

  const supabase = await createClient();

  // Append to the end of the current order. Computed in JS, same as
  // setProductFeatured above, so a legacy null position (a row from before
  // this column existed) can't make a max-value lookup misbehave.
  const { data: rows, error: rowsError } = await supabase
    .from("storefront_shortcuts")
    .select("position");
  if (rowsError) throw new Error(rowsError.message);
  const nextPosition =
    ((rows ?? []) as { position: number | null }[]).reduce(
      (max, r) => Math.max(max, r.position ?? -1),
      -1
    ) + 1;

  const { error } = await supabase
    .from("storefront_shortcuts")
    .insert({ label: trimmedLabel, href: trimmedHref, badge, position: nextPosition });
  if (error) throw new Error(error.message);

  revalidatePath("/zlap-adm/storefront");
  revalidatePath("/");
}

export async function updateStorefrontShortcut(shortcutId: string, label: string, href: string) {
  const trimmedLabel = label.trim();
  const trimmedHref = href.trim();
  if (!trimmedLabel) throw new Error("Label is required");
  if (!trimmedHref) throw new Error("Link is required");

  const supabase = await createClient();
  const { error } = await supabase
    .from("storefront_shortcuts")
    .update({ label: trimmedLabel, href: trimmedHref })
    .eq("id", shortcutId);
  if (error) throw new Error(error.message);

  revalidatePath("/zlap-adm/storefront");
  revalidatePath("/");
}

export async function updateStorefrontShortcutBadge(
  shortcutId: string,
  badge: StorefrontShortcutBadge | null
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("storefront_shortcuts")
    .update({ badge })
    .eq("id", shortcutId);
  if (error) throw new Error(error.message);

  revalidatePath("/zlap-adm/storefront");
  revalidatePath("/");
}

export async function reorderStorefrontShortcut(id: string, direction: "up" | "down") {
  const supabase = await createClient();

  const { data: rows, error } = await supabase.from("storefront_shortcuts").select("id, position");
  if (error) throw new Error(error.message);

  // Sorted in JS (nulls last), same self-healing approach as
  // reorderFeaturedProduct above — see that function's comment.
  const list = (rows ?? []) as { id: string; position: number | null }[];
  list.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));

  const index = list.findIndex((r) => r.id === id);
  if (index === -1) return;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= list.length) return;

  [list[index], list[swapIndex]] = [list[swapIndex], list[index]];

  for (let i = 0; i < list.length; i++) {
    const { error: updateError } = await supabase
      .from("storefront_shortcuts")
      .update({ position: i })
      .eq("id", list[i].id);
    if (updateError) throw new Error(updateError.message);
  }

  revalidatePath("/zlap-adm/storefront");
  revalidatePath("/");
}

export async function removeStorefrontShortcut(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("storefront_shortcuts").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/zlap-adm/storefront");
  revalidatePath("/");
}

export async function uploadStorefrontShortcutImage(shortcutId: string, formData: FormData) {
  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) return;

  const supabase = await createClient();
  const ext = file.name.split(".").pop();
  const path = `shortcuts/${shortcutId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);

  const { error } = await supabase
    .from("storefront_shortcuts")
    .update({ image_url: data.publicUrl })
    .eq("id", shortcutId);
  if (error) throw new Error(error.message);

  revalidatePath("/zlap-adm/storefront");
  revalidatePath("/");
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
    .eq(section, true);
  if (error) throw new Error(error.message);

  // Sorted in JS (nulls last) rather than "order by X asc" — a legacy row
  // with a null order (from before per-section ordering existed) would
  // otherwise land in a different spot here than in the admin page's own
  // list (which treats null the same way), making the swap act on the
  // wrong neighbor.
  const list = (rows ?? []) as unknown as Record<string, string | number | null>[];
  list.sort((a, b) => Number(a[orderColumn] ?? Infinity) - Number(b[orderColumn] ?? Infinity));

  const index = list.findIndex((r) => r.id === productId);
  if (index === -1) return;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= list.length) return;

  // Swap positions, then renumber the whole section sequentially (0, 1, 2…)
  // rather than swapping the two rows' raw order values — this also
  // self-heals any legacy null orders in the section instead of just
  // trading one null for another.
  [list[index], list[swapIndex]] = [list[swapIndex], list[index]];

  for (let i = 0; i < list.length; i++) {
    const { error: updateError } = await supabase
      .from("products")
      .update({ [orderColumn]: i })
      .eq("id", list[i].id);
    if (updateError) throw new Error(updateError.message);
  }

  revalidatePath("/zlap-adm/storefront");
  revalidatePath("/");
}
