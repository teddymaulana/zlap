"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { refundMidtrans } from "@/lib/midtrans";
import {
  sendShippedEmail,
  sendCancellationApprovedEmail,
  sendCancellationRejectedEmail,
  sendRefundCompletedEmail,
} from "@/lib/email";

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

export async function deleteOrder(orderId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").delete().eq("id", orderId);
  if (error) throw new Error(error.message);

  revalidatePath("/orders");
  redirect("/orders");
}

export async function updateOrderStatus(orderId: string, status: "pending" | "completed") {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw new Error(error.message);

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}

export async function updateOrderAwb(orderId: string, awb: string) {
  const trimmed = awb.trim();
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ awb: trimmed || null }).eq("id", orderId);
  if (error) throw new Error(error.message);

  if (trimmed) {
    const { data: order } = await supabase
      .from("orders")
      .select("order_id, customer_email, status")
      .eq("id", orderId)
      .maybeSingle();

    // Saving an AWB means the order shipped — mark it fulfilled too, unless
    // it was cancelled (don't reopen a cancelled order just because staff
    // recorded a resi number on it after the fact).
    if (order && order.status === "pending") {
      await supabase.from("orders").update({ status: "completed" }).eq("id", orderId);
    }

    if (order?.customer_email) {
      await sendShippedEmail({ to: order.customer_email, orderCode: order.order_id, awb: trimmed });
    }
  }

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

// Approving a cancellation attempts a Midtrans refund when the order was
// paid. bank_transfer (VA) can't be refunded through the API — Midtrans
// rejects it — so that case falls back to payment_status='refund_pending'
// for staff to wire the money back manually and confirm with
// markRefundComplete below.
export async function approveCancellation(orderId: string) {
  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_id, payment_status, customer_email")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error("Order not found");

  let paymentStatus = order.payment_status;

  if (order.payment_status === "paid") {
    const { data: lines, error: linesError } = await supabase
      .from("order_lines")
      .select("price")
      .eq("order_id", orderId);
    if (linesError) throw new Error(linesError.message);
    const total = (lines ?? []).reduce((sum, l) => sum + (l.price ?? 0), 0);

    try {
      await refundMidtrans(order.order_id, Math.round(total), "Customer requested cancellation");
      paymentStatus = "refunded";
    } catch {
      // Expected for bank_transfer (VA) — no API refund path exists.
      paymentStatus = "refund_pending";
    }
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled", payment_status: paymentStatus })
    .eq("id", orderId);
  if (error) throw new Error(error.message);

  if (order.customer_email) {
    await sendCancellationApprovedEmail({
      to: order.customer_email,
      orderCode: order.order_id,
      refunded: paymentStatus === "refunded",
    });
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/store/account");
}

export async function rejectCancellation(orderId: string) {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("order_id, customer_email")
    .eq("id", orderId)
    .maybeSingle();

  const { error } = await supabase
    .from("orders")
    .update({ cancellation_requested_at: null, cancellation_reason: null })
    .eq("id", orderId);
  if (error) throw new Error(error.message);

  if (order?.customer_email) {
    await sendCancellationRejectedEmail({ to: order.customer_email, orderCode: order.order_id });
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/store/account");
}

// Confirms a manual (outside-Midtrans) refund is done — see the
// refund_pending case in approveCancellation above.
export async function markRefundComplete(orderId: string) {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("order_id, customer_email")
    .eq("id", orderId)
    .maybeSingle();

  const { error } = await supabase
    .from("orders")
    .update({ payment_status: "refunded" })
    .eq("id", orderId);
  if (error) throw new Error(error.message);

  if (order?.customer_email) {
    await sendRefundCompletedEmail({ to: order.customer_email, orderCode: order.order_id });
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/store/account");
}
