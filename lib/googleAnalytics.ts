import { createSign } from "crypto";

// Read-only GA4 reports for the staff WhatsApp bot (lib/staffBot.ts), via the
// GA4 Data API (free for standard properties, quota-limited only).
//
// Env:
//   GA_PROPERTY_ID               numeric GA4 property ID (Admin > Property
//                                details), not the G-... measurement ID
//   GOOGLE_SERVICE_ACCOUNT_JSON  the service account's JSON key, either raw
//                                or base64-encoded (base64 avoids quoting
//                                trouble in env files). The account needs
//                                Viewer access on the GA property.
//
// Authenticates with the plain OAuth JWT-bearer flow using Node's crypto
// rather than pulling in googleapis/gRPC just for one REST call.

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REQUEST_TIMEOUT_MS = 15_000;

type ServiceAccount = { client_email: string; private_key: string };

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const parsed = JSON.parse(json);
  if (!parsed.client_email || !parsed.private_key) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email/private_key");
  return parsed;
}

export function isGoogleAnalyticsConfigured(): boolean {
  return !!process.env.GA_PROPERTY_ID && !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const account = serviceAccount();
  if (!account) throw new Error("Google Analytics is not configured");

  const now = Math.floor(Date.now() / 1000);
  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key).toString("base64url");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Google auth failed: ${body.error_description ?? body.error ?? res.status}`);
  cachedToken = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.token;
}

export type AnalyticsReportInput = {
  start_date?: string;
  end_date?: string;
  metrics?: string[];
  dimensions?: string[];
  filter?: { dimension?: string; contains?: string };
  order_by_metric?: string;
  limit?: number;
  realtime?: boolean;
};

// Returns a compact JSON table: column names plus one array per row.
export async function runAnalyticsReport(input: AnalyticsReportInput): Promise<string> {
  const propertyId = process.env.GA_PROPERTY_ID;
  if (!propertyId) throw new Error("Google Analytics is not configured");
  const metrics = input.metrics?.length ? input.metrics : ["activeUsers"];
  const dimensions = input.dimensions ?? [];
  const limit = Math.min(Math.max(Math.trunc(Number(input.limit) || 25), 1), 100);

  const body: Record<string, unknown> = {
    metrics: metrics.map((name) => ({ name })),
    dimensions: dimensions.map((name) => ({ name })),
    limit,
  };
  // Realtime reports cover the last 30 minutes and take no date range.
  if (!input.realtime) {
    body.dateRanges = [{ startDate: input.start_date || "7daysAgo", endDate: input.end_date || "today" }];
  }
  if (input.filter?.dimension && input.filter.contains) {
    body.dimensionFilter = {
      filter: {
        fieldName: input.filter.dimension,
        stringFilter: { matchType: "CONTAINS", value: input.filter.contains, caseSensitive: false },
      },
    };
  }
  if (input.order_by_metric) body.orderBys = [{ metric: { metricName: input.order_by_metric }, desc: true }];
  else if (dimensions.includes("date")) body.orderBys = [{ dimension: { dimensionName: "date" } }];

  const method = input.realtime ? "runRealtimeReport" : "runReport";
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google Analytics error: ${data.error?.message ?? res.status}`);

  const columns = [...dimensions, ...metrics];
  const rows = (data.rows ?? []).map((row: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }) => [
    ...(row.dimensionValues ?? []).map((v) => v.value),
    ...(row.metricValues ?? []).map((v) => v.value),
  ]);
  return JSON.stringify({ columns, rows, total_rows: data.rowCount ?? rows.length });
}
