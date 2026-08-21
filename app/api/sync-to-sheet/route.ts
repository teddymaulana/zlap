import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const scriptUrl = process.env.SYNC_TO_SHEET_URL;
  if (!scriptUrl) {
    return NextResponse.json({ error: "SYNC_TO_SHEET_URL is not configured" }, { status: 500 });
  }

  const payload = await request.json();

  const res = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();

  return NextResponse.json({ status: res.status, body: text }, { status: res.status });
}
