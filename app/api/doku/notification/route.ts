import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifyDokuNotification } from "@/lib/doku";
import { sendPaymentConfirmedEmail } from "@/lib/email";

const NOTIFICATION_PATH = "/api/doku/notification";

// Only the fields we read — matches DOKU's published HTTP notification
// samples (https://dashboard.doku.com/docs/docs/http-notification/http-notification/).
// The rest of the body (service/acquirer/channel/…) varies per channel.
type DokuNotification = {
  order: { invoice_number: string; amount?: number };
  transaction: { status: "SUCCESS" | "PENDING" | "FAILED" | string };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const clientId = request.headers.get("client-id");
  const requestId = request.headers.get("request-id");
  const timestamp = request.headers.get("request-timestamp");
  const signatureHeader = request.headers.get("signature");

  if (!clientId || !requestId || !timestamp || !signatureHeader) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });
  }

  const valid = verifyDokuNotification({
    clientId,
    requestId,
    timestamp,
    target: NOTIFICATION_PATH,
    rawBody,
    signatureHeader,
  });
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const body = JSON.parse(rawBody) as DokuNotification;

  // Per DOKU's own Checkout integration guidance: a FAILED notification just
  // means the customer's first payment attempt failed and they may retry
  // with another method on the same DOKU page — it should be ignored rather
  // than mapped to our "failed" status.
  const newStatus = body.transaction.status === "SUCCESS" ? "paid" : body.transaction.status === "PENDING" ? "pending" : null;
  if (!newStatus) return NextResponse.json({ received: true });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: existing } = await service
    .from("orders")
    .select("id, customer_email, payment_status")
    .eq("order_id", body.order.invoice_number)
    .maybeSingle();

  const { error } = await service
    .from("orders")
    .update({ payment_status: newStatus })
    .eq("order_id", body.order.invoice_number);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // DOKU can redeliver notifications — only email on the actual
  // unpaid -> paid transition, not every redelivery.
  if (newStatus === "paid" && existing?.payment_status !== "paid" && existing?.customer_email) {
    await sendPaymentConfirmedEmail({ to: existing.customer_email, orderCode: body.order.invoice_number });
  }

  return NextResponse.json({ received: true });
}
