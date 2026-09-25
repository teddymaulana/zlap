import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { applyDokuStatus, verifyDokuNotification, type DokuTransactionStatus } from "@/lib/doku";

const NOTIFICATION_PATH = "/api/doku/notification";

// Only the fields we read — matches DOKU's published HTTP notification
// samples (https://dashboard.doku.com/docs/docs/http-notification/http-notification/).
// The rest of the body (service/acquirer/channel/…) varies per channel.
type DokuNotification = {
  order: { invoice_number: string; amount?: number };
  transaction: { status: DokuTransactionStatus };
};

// Rejections are logged (without the body) so a misconfigured notification
// URL or key mismatch shows up in the host's function logs — otherwise the
// only symptom is orders silently staying "pending".
export async function POST(request: Request) {
  const rawBody = await request.text();
  const clientId = request.headers.get("client-id");
  const requestId = request.headers.get("request-id");
  const timestamp = request.headers.get("request-timestamp");
  const signatureHeader = request.headers.get("signature");

  if (!clientId || !requestId || !timestamp || !signatureHeader) {
    console.error("[doku] notification missing signature headers", {
      clientId: !!clientId,
      requestId: !!requestId,
      timestamp: !!timestamp,
      signature: !!signatureHeader,
    });
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
    console.error("[doku] notification signature mismatch", {
      requestId,
      clientIdMatchesEnv: clientId === process.env.DOKU_CLIENT_ID,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const body = JSON.parse(rawBody) as DokuNotification;

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await applyDokuStatus(service, body.order.invoice_number, body.transaction.status);
  if (error) {
    console.error("[doku] failed to apply notification", { invoice: body.order.invoice_number, error });
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
