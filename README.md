# zlap-erp (Next.js + Supabase)

Internal tool for tracking batch-costed inventory, purchases, and multi-channel
orders. Replaces the old Strapi app — see `../zlap-erp` for the source it was
migrated from.

- **Products** — each product has one or more inventory batches (a purchase
  lot), with its own cost, platform fee %, and markup %.
- **Purchases** — build a list of lines (product, qty, unit cost), allocate
  shipping/handling fees across them, then "push" to create inventory
  batches.
- **Orders** — pick a specific available batch per line; profit is
  `price - batch cost`. Availability is derived from `order_lines`, not a
  stored counter, so add/remove is a plain insert/delete.
- **Cash, Snapshots, Supplier Pricelist** — flat tables, managed directly in
  the Supabase Table Editor (no app pages for these).

## Setup

1. Create a Supabase project. In **SQL Editor**, run `supabase/schema.sql` —
   creates all tables, the `inventory_batch_availability` view, RLS policies,
   and the `product-images` storage bucket.
2. Create at least one user under **Authentication → Users** (email/password)
   — this is an internal tool, there's no public sign-up.
3. Copy `.env.local.example` to `.env.local` and fill in the values from
   **Project Settings → API** (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
4. `npm install && npm run dev`, sign in at `/login`.

## Migrating data from the old Strapi app

`scripts/migrate.ts` reads straight from the old Strapi Postgres database and
writes into the new Supabase schema, exploding Strapi's JSON blob fields
(`custom_data`) into the normalized tables here.

1. Set `STRAPI_DATABASE_URL` in `.env.local` to the old app's
   `DATABASE_URL` (see `../zlap-erp/.env`).
2. Run against a **staging** Supabase project first: `npm run migrate`.
3. Spot-check: pick a few products/purchases/orders you recognize and compare
   row-for-row against the Strapi admin. Two mappings are inherently
   approximate (see comments at the top of `scripts/migrate.ts`) — purchase
   lines are paired with the inventory batches they created positionally,
   since Strapi never stored that link directly.
4. Once satisfied, run it again against the real Supabase project.

## Deploying

Push to a Git repo, import into Vercel, add the same env vars from
`.env.local` (including `SYNC_TO_SHEET_URL` if you use the sheet-sync
endpoint) under **Project Settings → Environment Variables**, deploy.

## What was intentionally dropped

- The PSA10 price-charting scraper (it depended on attaching to the
  operator's own local Chrome instance — inherently can't run on Vercel).
# zlap
