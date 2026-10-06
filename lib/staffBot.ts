import { readFileSync } from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

// Staff WhatsApp bot: answers questions about stock, products, orders,
// customers, purchases, etc. by letting Claude run read-only queries against
// Supabase. Called from app/api/whatsapp/webhook for allowlisted staff
// numbers only.
//
// The whole of supabase/schema.sql goes into the system prompt — its
// comments already explain what every table and column means, so the bot
// stays accurate as the schema grows without a second description to keep
// in sync. It's ~15k tokens and cached, so repeat questions are cheap.
//
// Read-only by construction: the only tool builds a supabase-js select, and
// there is no code path here that inserts, updates or deletes.

const MODEL = "claude-sonnet-5-5";
const MAX_TOOL_ROUNDS = 10;
const MAX_ROWS = 100;
// Keeps one huge result from flooding the context; the model is told to
// narrow its query when it sees the truncation note.
const MAX_RESULT_CHARS = 30_000;
const HISTORY_MESSAGES = 20;
const HISTORY_HOURS = 24;

// Everything in schema.sql that's useful to staff. customer_sessions is left
// out (raw login session ids), and wa_bot_messages is the bot's own memory.
const QUERYABLE = [
  "products",
  "card_sets",
  "inventory_batches",
  "inventory_batch_availability",
  "product_po_open",
  "purchases",
  "purchase_lines",
  "purchase_po_delays",
  "orders",
  "order_lines",
  "customers",
  "wishlist_items",
  "offers",
  "card_requests",
  "stock_notifications",
  "discounts",
  "discount_products",
  "discount_redemptions",
  "cash",
  "balances",
  "marketplace_balances",
  "snapshots",
  "supplier_pricelist",
  "storefront_sections",
  "storefront_settings",
  "storefront_shortcuts",
  "popular_keywords",
  "product_views",
  "regions",
] as const;

// Stripped from every result, at any nesting depth: password hashes, and
// the reset/verification/checkout tokens that would let someone act as a
// customer or pay link.
const SENSITIVE_KEY = /password|token|secret/i;

const FILTER_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is"] as const;
type FilterOp = (typeof FILTER_OPS)[number];

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "query_database",
    description:
      "Run a read-only query on one table or view of the shop database (Supabase/PostgREST via supabase-js). " +
      "Returns matching rows as JSON plus the total match count. Use PostgREST select syntax, including embedded " +
      "relations through foreign keys, e.g. select \"order_id, status, order_lines(price, is_po, products(name))\". " +
      "To filter on an embedded table, embed it with !inner (\"*, products!inner(name)\") and filter on " +
      "\"products.name\". Prefer selecting only the columns you need. For current stock use the " +
      "inventory_batch_availability view (sum `available` per product_id).",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string", enum: [...QUERYABLE] },
        select: { type: "string", description: "PostgREST select string. Defaults to *." },
        filters: {
          type: "array",
          description: "ANDed together.",
          items: {
            type: "object",
            properties: {
              column: { type: "string" },
              op: { type: "string", enum: [...FILTER_OPS] },
              value: {
                description:
                  "ilike/like take a pattern with % wildcards. in takes an array. is takes null, true or false.",
              },
            },
            required: ["column", "op", "value"],
          },
        },
        or: {
          type: "string",
          description: 'Optional raw PostgREST or-filter, e.g. "name.ilike.%151%,sku.ilike.%151%".',
        },
        order: {
          type: "object",
          properties: { column: { type: "string" }, ascending: { type: "boolean" } },
          required: ["column"],
        },
        limit: { type: "integer", description: `Max rows to return, 1-${MAX_ROWS}. Default 20.` },
      },
      required: ["table"],
    },
  },
];

let systemPrompt: string | null = null;

function getSystemPrompt(): string {
  if (systemPrompt) return systemPrompt;
  const schema = readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8");
  systemPrompt = `You are the internal WhatsApp assistant for Zlap Card staff. Zlap Card is an Indonesian shop selling Pokémon and One Piece trading card products (booster boxes, packs, singles and graded slabs) through its own website (zlapcards.com) and marketplaces like Tokopedia and Shopee.

Staff message you to look things up: stock levels, product details and prices, orders and their payment/shipping status, customer history, pre-orders, purchases, offers, card requests, balances, and anything else in the database. Use the query_database tool to answer from live data. Never guess numbers, names or statuses; if the data doesn't answer the question, say so. You can only read data. If someone asks you to change something, tell them to do it in the admin at https://zlapcards.com/zlap-adm.

How the data works:
- Physical stock is per inventory batch. Current stock for a product = sum of \`available\` over its rows in inventory_batch_availability (\`storefront_available\` is what the website can still sell). A product at 0 stock with pre-order batches is expected, not a problem.
- An order's total is the sum of its order_lines.price. Each order line is one unit, so count lines per product for quantities.
- payment_status is only meaningful for website orders (channel = 'website') paid through the payment gateway. Marketplace and manual orders leave it at 'unpaid', so never report those as unpaid; use orders.status for them.
- orders.order_id is the human order code staff will quote (e.g. from WhatsApp alerts); orders.id is the internal uuid.
- Match product names loosely with ilike and % wildcards, and try alternatives (e.g. "151", "SV2a") if the first search finds nothing.
- Admin links: https://zlapcards.com/zlap-adm/orders/<orders.id>, https://zlapcards.com/zlap-adm/products/<products.id>, https://zlapcards.com/zlap-adm/customers/<customers.id>.

Replying:
- Reply in the language the staff member writes in (usually Indonesian).
- This is WhatsApp: keep it short and scannable. Use *bold* and simple "- " lists. No markdown headings, tables or [link](url) syntax; paste bare URLs.
- Money is IDR, formatted like Rp 1.250.000. Dates in Asia/Jakarta time.
- When a list is long, show the most relevant items and say how many more there are.

Database schema (supabase/schema.sql, including its comments):

${schema}`;
  return systemPrompt;
}

function stripSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSensitive);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEY.test(key))
        .map(([key, v]) => [key, stripSensitive(v)])
    );
  }
  return value;
}

type QueryInput = {
  table?: string;
  select?: string;
  filters?: { column?: string; op?: string; value?: unknown }[];
  or?: string;
  order?: { column?: string; ascending?: boolean };
  limit?: number;
};

export async function queryDatabase(service: SupabaseClient, input: QueryInput): Promise<string> {
  if (!input.table || !(QUERYABLE as readonly string[]).includes(input.table)) {
    throw new Error(`Unknown table "${input.table}". Allowed: ${QUERYABLE.join(", ")}`);
  }
  const limit = Math.min(Math.max(Math.trunc(Number(input.limit) || 20), 1), MAX_ROWS);

  let query = service.from(input.table).select(input.select?.trim() || "*", { count: "exact" });
  for (const f of input.filters ?? []) {
    if (!f.column || !FILTER_OPS.includes(f.op as FilterOp)) throw new Error(`Invalid filter: ${JSON.stringify(f)}`);
    const op = f.op as FilterOp;
    if (op === "in") {
      const values = Array.isArray(f.value) ? f.value : String(f.value).split(",").map((v) => v.trim());
      query = query.in(f.column, values);
    } else if (op === "is") {
      query = query.is(f.column, f.value as boolean | null);
    } else {
      query = query.filter(f.column, op, f.value);
    }
  }
  if (input.or) query = query.or(input.or);
  if (input.order?.column) query = query.order(input.order.column, { ascending: input.order.ascending ?? true });

  const { data, error, count } = await query.limit(limit);
  if (error) throw new Error(error.message);

  const rows = stripSensitive(data ?? []) as unknown[];
  let json = JSON.stringify({ total_matches: count, returned: rows.length, rows });
  if (json.length > MAX_RESULT_CHARS) {
    json = `${json.slice(0, MAX_RESULT_CHARS)}\n…[truncated: select fewer columns or add filters]`;
  }
  return json;
}

function jakartaNow() {
  return new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "short",
  });
}

// Recent plain-text turns for this number, oldest first. Only the final
// texts are stored (not tool calls), which is enough for follow-ups and keeps
// each request small.
async function loadHistory(service: SupabaseClient, phone: string): Promise<Anthropic.Beta.BetaMessageParam[]> {
  const since = new Date(Date.now() - HISTORY_HOURS * 60 * 60 * 1000).toISOString();
  const { data } = await service
    .from("wa_bot_messages")
    .select("role, content")
    .eq("phone", phone)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(HISTORY_MESSAGES);
  const history = (data ?? []).reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content as string,
  }));
  // The API requires the conversation to open with a user turn.
  while (history.length > 0 && history[0].role !== "user") history.shift();
  return history;
}

// `history` already ends with the staff member's new message (it was stored
// before this runs). Returns the reply text to send back.
export async function answerStaffMessage(service: SupabaseClient, phone: string): Promise<string> {
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = await loadHistory(service, phone);
  if (messages.length === 0) return "Sorry, I couldn't read that message. Please try again.";
  // The current time goes on the newest message rather than in the system
  // prompt, so the cached system prompt stays byte-identical between requests.
  messages.push({ role: "user", content: `[Current time in Jakarta: ${jakartaNow()}]` });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      // On a policy decline, the API retries the same request on Anthropic's
      // default fallback model instead of returning an empty refusal.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: getSystemPrompt(), cache_control: { type: "ephemeral" } }],
      tools,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return "Sorry, I can't help with that one.";
    }

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "pause_turn") continue;
    if (response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return text || "Sorry, I couldn't come up with an answer. Please try rephrasing.";
    }

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (tool) => {
        try {
          if (tool.name !== "query_database") throw new Error(`Unknown tool ${tool.name}`);
          const content = await queryDatabase(service, tool.input as QueryInput);
          return { type: "tool_result" as const, tool_use_id: tool.id, content };
        } catch (err) {
          return {
            type: "tool_result" as const,
            tool_use_id: tool.id,
            content: err instanceof Error ? err.message : String(err),
            is_error: true,
          };
        }
      })
    );
    messages.push({ role: "user", content: results });
  }

  return "Sorry, that question needed too many lookups. Could you ask something more specific?";
}
