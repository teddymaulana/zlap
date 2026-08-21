"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createOrder(formData: FormData) {
  const orderId = String(formData.get("order_id") ?? "").trim();
  if (!orderId) throw new Error("Order ID is required");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .insert({
      order_id: orderId,
      channel: String(formData.get("channel") ?? "") || null,
      date: String(formData.get("date") ?? "") || null,
      order_url: String(formData.get("order_url") ?? "").trim() || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/orders");
  redirect(`/orders/${data.id}`);
}

export async function updateOrderStatus(orderId: string, status: "pending" | "completed") {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw new Error(error.message);

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}

// Guards against overselling by re-checking the batch's derived availability
// (qty minus existing order_lines against it) right before inserting.
export async function addOrderLine(
  orderId: string,
  productId: string,
  inventoryBatchId: string,
  price: number
) {
  const supabase = await createClient();

  const { data: batch, error: batchError } = await supabase
    .from("inventory_batch_availability")
    .select("available")
    .eq("id", inventoryBatchId)
    .single();
  if (batchError) throw new Error(batchError.message);
  if (!batch || batch.available <= 0) {
    throw new Error("That batch has no available stock left");
  }

  const { error } = await supabase.from("order_lines").insert({
    order_id: orderId,
    product_id: productId,
    inventory_batch_id: inventoryBatchId,
    price,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/orders/${orderId}`);
}

export async function updateOrderLinePrice(orderId: string, lineId: string, price: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("order_lines").update({ price }).eq("id", lineId);
  if (error) throw new Error(error.message);

  revalidatePath(`/orders/${orderId}`);
}

export async function removeOrderLine(orderId: string, lineId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("order_lines").delete().eq("id", lineId);
  if (error) throw new Error(error.message);

  revalidatePath(`/orders/${orderId}`);
}
