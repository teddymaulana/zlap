import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";
import { OrderLabelDocument } from "@/lib/orderLabel";

export const runtime = "nodejs";

// Not covered by the "/zlap-adm" middleware gate (that only matches page
// routes), so auth is re-checked here — this returns the customer's name,
// phone, and address, which shouldn't be fetchable by an unauthenticated
// request just because the id is guessed.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const [
    { data: order, error: orderError },
    { count: itemCount, error: linesError },
  ] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_lines").select("id", { count: "exact", head: true }).eq("order_id", id),
  ]);
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (linesError) return NextResponse.json({ error: linesError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const o = order as Order;
  const pdfBuffer = await renderToBuffer(<OrderLabelDocument order={o} itemCount={itemCount ?? 0} />);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      // "inline" opens the PDF viewer directly (rather than forcing a
      // download) so staff can hit Ctrl/Cmd+P and print straight to the
      // thermal printer from there.
      "Content-Disposition": `inline; filename="label-${o.order_id}.pdf"`,
    },
  });
}
