import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendPaymentConfirmedEmail } from "@/lib/email";

type MidtransNotification = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
};

function paymentStatusFor(body: MidtransNotification): "paid" | "pending" | "failed" | "expired" {
  if (body.transaction_status === "capture") {
    return body.fraud_status === "accept" ? "paid" : "failed";
  }
  if (body.transaction_status === "settlement") return "paid";
  if (body.transaction_status === "pending") return "pending";
  if (body.transaction_status === "expire") return "expired";
  return "failed"; // deny, cancel, refund, etc.
}

export async function POST(request: Request) {
  const body = (await request.json()) as MidtransNotification;

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    return NextResponse.json({ error: "Payment isn't configured" }, { status: 500 });
  }

  const expectedSignature = createHash("sha512")
    .update(body.order_id + body.status_code + body.gross_amount + serverKey)
    .digest("hex");
  if (expectedSignature !== body.signature_key) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: existing } = await service
    .from("orders")
    .select("id, customer_email, payment_status")
    .eq("order_id", body.order_id)
    .maybeSingle();

  const newStatus = paymentStatusFor(body);
  const { error } = await service
    .from("orders")
    .update({ payment_status: newStatus })
    .eq("order_id", body.order_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Midtrans can send the same notification more than once (retries) — only
  // email on the actual unpaid -> paid transition, not every redelivery.
  if (newStatus === "paid" && existing?.payment_status !== "paid" && existing?.customer_email) {
    await sendPaymentConfirmedEmail({ to: existing.customer_email, orderCode: body.order_id });
  }

  return NextResponse.json({ received: true });
}
