import { createHmac, timingSafeEqual } from "crypto";
import { after, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { answerStaffMessage } from "@/lib/staffBot";
import { markReadWithTyping, sendWhatsAppText } from "@/lib/whatsapp";

// Meta WhatsApp Cloud API webhook for the staff bot (lib/staffBot.ts).
//
// Env:
//   WHATSAPP_VERIFY_TOKEN   any string; must match "Verify token" in the Meta
//                           app's WhatsApp > Configuration > Webhook settings
//   WHATSAPP_APP_SECRET     Meta app secret (App settings > Basic), used to
//                           check every POST really came from Meta
//   WHATSAPP_STAFF_NUMBERS  comma-separated numbers allowed to use the bot,
//                           e.g. 62812...; falls back to WHATSAPP_ADMIN_NUMBERS
//   ANTHROPIC_API_KEY       for Claude
// plus WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID for replies (lib/whatsapp.ts).
//
// Meta wants a 200 quickly and retries otherwise, so the answer is worked
// out in after() once the response has gone back. A Claude answer with a few
// lookups usually takes 5–30s.
export const maxDuration = 60;

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function staffNumbers(): Set<string> {
  const raw = process.env.WHATSAPP_STAFF_NUMBERS || process.env.WHATSAPP_ADMIN_NUMBERS || "";
  return new Set(raw.split(",").map((n) => n.replace(/\D/g, "")).filter(Boolean));
}

// Webhook verification handshake, done once when the URL is saved in Meta.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (
    verifyToken &&
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === verifyToken
  ) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

function hasValidSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const supplied = Buffer.from(header.slice("sha256=".length), "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

type IncomingMessage = { from: string; id: string; type: string; text?: { body?: string } };

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!hasValidSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  // Delivery/read receipts arrive here too (value.statuses); only actual
  // messages are handled.
  const messages: IncomingMessage[] = (payload.entry ?? []).flatMap(
    (entry: { changes?: { value?: { messages?: IncomingMessage[] } }[] }) =>
      (entry.changes ?? []).flatMap((change) => change.value?.messages ?? [])
  );

  const staff = staffNumbers();
  for (const message of messages) {
    // Customers get nothing back yet — the customer-facing bot comes later.
    if (!staff.has(message.from)) continue;
    after(() => handleStaffMessage(message));
  }

  return NextResponse.json({ ok: true });
}

async function handleStaffMessage(message: IncomingMessage) {
  const service = serviceClient();
  const text = message.text?.body?.trim();

  try {
    if (message.type !== "text" || !text) {
      await sendWhatsAppText(message.from, "I can only read text messages for now.");
      return;
    }

    // The unique wa_message_id doubles as the retry guard: if Meta delivers
    // the same message twice, the second insert fails and we stop here.
    const { error: insertError } = await service
      .from("wa_bot_messages")
      .insert({ phone: message.from, role: "user", content: text, wa_message_id: message.id });
    if (insertError) {
      if (insertError.code !== "23505") console.error("[wa-bot] storing message failed:", insertError);
      return;
    }

    await markReadWithTyping(message.id);
    const reply = await answerStaffMessage(service, message.from);
    await service.from("wa_bot_messages").insert({ phone: message.from, role: "assistant", content: reply });
    await sendWhatsAppText(message.from, reply);
  } catch (err) {
    console.error("[wa-bot] failed to answer", message.id, err);
    await sendWhatsAppText(message.from, "Sorry, something went wrong answering that. Please try again.");
  }
}
