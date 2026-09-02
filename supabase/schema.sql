-- zlap-erp schema
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).

create extension if not exists "pgcrypto";

-- Reference catalog of card sets/expansions, managed from /sets in the ERP.
-- Seeded below with real Pokemon (EN/JP/ID) and One Piece (EN) sets; admins
-- add new ones as they release rather than needing a code change.
create table if not exists card_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null check (brand in ('pokemon', 'one_piece')),
  language text not null check (language in ('en', 'jp', 'id')),
  created_at timestamptz not null default now(),
  unique (name, brand, language)
);

insert into card_sets (name, brand, language) values
  -- English Pokemon sets, Base Set (1999) through the most recent release.
  ('Base Set', 'pokemon', 'en'), ('Jungle', 'pokemon', 'en'), ('Fossil', 'pokemon', 'en'),
  ('Base Set 2', 'pokemon', 'en'), ('Team Rocket', 'pokemon', 'en'), ('Gym Heroes', 'pokemon', 'en'),
  ('Gym Challenge', 'pokemon', 'en'), ('Neo Genesis', 'pokemon', 'en'), ('Neo Discovery', 'pokemon', 'en'),
  ('Neo Revelation', 'pokemon', 'en'), ('Neo Destiny', 'pokemon', 'en'), ('Legendary Collection', 'pokemon', 'en'),
  ('Expedition Base Set', 'pokemon', 'en'), ('Aquapolis', 'pokemon', 'en'), ('Skyridge', 'pokemon', 'en'),
  ('EX Ruby & Sapphire', 'pokemon', 'en'), ('EX Sandstorm', 'pokemon', 'en'), ('EX Dragon', 'pokemon', 'en'),
  ('EX Team Magma vs Team Aqua', 'pokemon', 'en'), ('EX Hidden Legends', 'pokemon', 'en'),
  ('EX FireRed & LeafGreen', 'pokemon', 'en'), ('EX Team Rocket Returns', 'pokemon', 'en'),
  ('EX Deoxys', 'pokemon', 'en'), ('EX Emerald', 'pokemon', 'en'), ('EX Unseen Forces', 'pokemon', 'en'),
  ('EX Delta Species', 'pokemon', 'en'), ('EX Legend Maker', 'pokemon', 'en'), ('EX Holon Phantoms', 'pokemon', 'en'),
  ('EX Crystal Guardians', 'pokemon', 'en'), ('EX Dragon Frontiers', 'pokemon', 'en'),
  ('EX Power Keepers', 'pokemon', 'en'), ('Diamond & Pearl', 'pokemon', 'en'), ('Mysterious Treasures', 'pokemon', 'en'),
  ('Secret Wonders', 'pokemon', 'en'), ('Great Encounters', 'pokemon', 'en'), ('Majestic Dawn', 'pokemon', 'en'),
  ('Legends Awakened', 'pokemon', 'en'), ('Stormfront', 'pokemon', 'en'), ('Platinum', 'pokemon', 'en'),
  ('Rising Rivals', 'pokemon', 'en'), ('Supreme Victors', 'pokemon', 'en'), ('Arceus', 'pokemon', 'en'),
  ('HeartGold & SoulSilver', 'pokemon', 'en'), ('Unleashed', 'pokemon', 'en'), ('Undaunted', 'pokemon', 'en'),
  ('Triumphant', 'pokemon', 'en'), ('Call of Legends', 'pokemon', 'en'), ('Black & White', 'pokemon', 'en'),
  ('Emerging Powers', 'pokemon', 'en'), ('Noble Victories', 'pokemon', 'en'), ('Next Destinies', 'pokemon', 'en'),
  ('Dark Explorers', 'pokemon', 'en'), ('Dragon Vault', 'pokemon', 'en'), ('Boundaries Crossed', 'pokemon', 'en'),
  ('Plasma Storm', 'pokemon', 'en'), ('Plasma Freeze', 'pokemon', 'en'), ('Plasma Blast', 'pokemon', 'en'),
  ('Legendary Treasures', 'pokemon', 'en'), ('Kalos Starter Set', 'pokemon', 'en'), ('XY', 'pokemon', 'en'),
  ('Flashfire', 'pokemon', 'en'), ('Furious Fists', 'pokemon', 'en'), ('Phantom Forces', 'pokemon', 'en'),
  ('Primal Clash', 'pokemon', 'en'), ('Double Crisis', 'pokemon', 'en'), ('Roaring Skies', 'pokemon', 'en'),
  ('Ancient Origins', 'pokemon', 'en'), ('BREAKthrough', 'pokemon', 'en'), ('BREAKpoint', 'pokemon', 'en'),
  ('Generations', 'pokemon', 'en'), ('Fates Collide', 'pokemon', 'en'), ('Steam Siege', 'pokemon', 'en'),
  ('Evolutions', 'pokemon', 'en'), ('Sun & Moon', 'pokemon', 'en'), ('Guardians Rising', 'pokemon', 'en'),
  ('Burning Shadows', 'pokemon', 'en'), ('Shining Legends', 'pokemon', 'en'), ('Crimson Invasion', 'pokemon', 'en'),
  ('Ultra Prism', 'pokemon', 'en'), ('Forbidden Light', 'pokemon', 'en'), ('Celestial Storm', 'pokemon', 'en'),
  ('Dragon Majesty', 'pokemon', 'en'), ('Lost Thunder', 'pokemon', 'en'), ('Team Up', 'pokemon', 'en'),
  ('Detective Pikachu', 'pokemon', 'en'), ('Unbroken Bonds', 'pokemon', 'en'), ('Hidden Fates', 'pokemon', 'en'),
  ('Unified Minds', 'pokemon', 'en'), ('Cosmic Eclipse', 'pokemon', 'en'), ('Sword & Shield', 'pokemon', 'en'),
  ('Rebel Clash', 'pokemon', 'en'), ('Darkness Ablaze', 'pokemon', 'en'), ('Pokémon Futsal', 'pokemon', 'en'),
  ('Champion''s Path', 'pokemon', 'en'), ('Vivid Voltage', 'pokemon', 'en'), ('Shining Fates', 'pokemon', 'en'),
  ('Battle Styles', 'pokemon', 'en'), ('Chilling Reign', 'pokemon', 'en'), ('Evolving Skies', 'pokemon', 'en'),
  ('Celebrations', 'pokemon', 'en'), ('Fusion Strike', 'pokemon', 'en'), ('Brilliant Stars', 'pokemon', 'en'),
  ('Astral Radiance', 'pokemon', 'en'), ('Pokémon GO', 'pokemon', 'en'), ('Lost Origin', 'pokemon', 'en'),
  ('Silver Tempest', 'pokemon', 'en'), ('Crown Zenith', 'pokemon', 'en'), ('Scarlet & Violet', 'pokemon', 'en'),
  ('Paldea Evolved', 'pokemon', 'en'), ('Obsidian Flames', 'pokemon', 'en'), ('151', 'pokemon', 'en'),
  ('Paradox Rift', 'pokemon', 'en'), ('Paldean Fates', 'pokemon', 'en'), ('Temporal Forces', 'pokemon', 'en'),
  ('Twilight Masquerade', 'pokemon', 'en'), ('Shrouded Fable', 'pokemon', 'en'), ('Stellar Crown', 'pokemon', 'en'),
  ('Surging Sparks', 'pokemon', 'en'), ('Prismatic Evolutions', 'pokemon', 'en'), ('Journey Together', 'pokemon', 'en'),
  ('Destined Rivals', 'pokemon', 'en'), ('Black Bolt', 'pokemon', 'en'), ('White Flare', 'pokemon', 'en'),
  ('Mega Evolution', 'pokemon', 'en'), ('Phantasmal Flames', 'pokemon', 'en'), ('Ascended Heroes', 'pokemon', 'en'),
  ('Perfect Order', 'pokemon', 'en'), ('Chaos Rising', 'pokemon', 'en'), ('Pitch Black', 'pokemon', 'en'),

  -- Japanese Pokemon sets — Sword & Shield era onward (matches the modern
  -- Japanese product this shop actually stocks; dual releases like
  -- "Sword • Shield" are split into their two individual box names).
  ('Sword', 'pokemon', 'jp'), ('Shield', 'pokemon', 'jp'), ('Rebellion Crash', 'pokemon', 'jp'),
  ('Infinity Zone', 'pokemon', 'jp'), ('Amazing Volt Tackle', 'pokemon', 'jp'),
  ('Single Strike Master', 'pokemon', 'jp'), ('Rapid Strike Master', 'pokemon', 'jp'),
  ('Silver Lance', 'pokemon', 'jp'), ('Jet-Black Spirit', 'pokemon', 'jp'),
  ('Skyscraping Perfection', 'pokemon', 'jp'), ('Blue Sky Stream', 'pokemon', 'jp'),
  ('Fusion Arts', 'pokemon', 'jp'), ('Star Birth', 'pokemon', 'jp'), ('Time Gazer', 'pokemon', 'jp'),
  ('Space Juggler', 'pokemon', 'jp'), ('Lost Abyss', 'pokemon', 'jp'), ('Paradigm Trigger', 'pokemon', 'jp'),
  ('Scarlet ex', 'pokemon', 'jp'), ('Violet ex', 'pokemon', 'jp'), ('Snow Hazard', 'pokemon', 'jp'),
  ('Clay Burst', 'pokemon', 'jp'), ('Ruler of the Black Flame', 'pokemon', 'jp'), ('Ancient Roar', 'pokemon', 'jp'),
  ('Future Flash', 'pokemon', 'jp'), ('Wild Force', 'pokemon', 'jp'), ('Cyber Judge', 'pokemon', 'jp'),
  ('Transformation Mask', 'pokemon', 'jp'), ('Stellar Miracle', 'pokemon', 'jp'),
  ('Super Electric Breaker', 'pokemon', 'jp'), ('Battle Partners', 'pokemon', 'jp'),
  ('Glory of the Rocket Gang', 'pokemon', 'jp'), ('Black Bolt', 'pokemon', 'jp'), ('White Flare', 'pokemon', 'jp'),
  ('Mega Brave', 'pokemon', 'jp'), ('Mega Symphonia', 'pokemon', 'jp'), ('Inferno X', 'pokemon', 'jp'),
  ('Nihil Zero', 'pokemon', 'jp'), ('Ninja Spinner', 'pokemon', 'jp'), ('Abyss Eye', 'pokemon', 'jp'),
  ('Storm Emeralda', 'pokemon', 'jp'), ('Mega Dream', 'pokemon', 'jp'),

  -- Indonesian-language Pokemon releases (locally printed translations of
  -- Japanese sets).
  ('Topeng Transfigurasi', 'pokemon', 'id'), ('Bimbingan Rasi', 'pokemon', 'id'),
  ('Hitam & Putih', 'pokemon', 'id'), ('Pertemuan Paradoks', 'pokemon', 'id'),

  -- One Piece Card Game, English releases.
  ('OP-01 Romance Dawn', 'one_piece', 'en'), ('OP-02 Paramount War', 'one_piece', 'en'),
  ('OP-03 Pillars of Strength', 'one_piece', 'en'), ('OP-04 Kingdoms of Intrigue', 'one_piece', 'en'),
  ('OP-05 Awakening of the New Era', 'one_piece', 'en'), ('OP-06 Wings of the Captain', 'one_piece', 'en'),
  ('OP-07 500 Years Into the Future', 'one_piece', 'en'), ('OP-08 Two Legends', 'one_piece', 'en'),
  ('OP-09 Emperors in the New World', 'one_piece', 'en'), ('OP-10 Royal Blood', 'one_piece', 'en'),
  ('OP-11 A Fist of Divine Speed', 'one_piece', 'en'), ('OP-12 Legacy of the Master', 'one_piece', 'en'),
  ('OP-13 Carrying On His Will', 'one_piece', 'en'), ('OP-14 The Azure Sea''s Seven', 'one_piece', 'en'),
  ('OP-15 Adventure on Kami''s Island', 'one_piece', 'en'), ('OP-16 The Time of Battle', 'one_piece', 'en'),
  ('EB-01 Memorial Collection', 'one_piece', 'en'), ('EB-02 Anime 25th Collection', 'one_piece', 'en'),
  ('EB-03 Heroines Edition', 'one_piece', 'en'),

  -- One Piece Card Game, Japanese releases — same OP-01..OP-16 line (Japan
  -- gets each set first, English follows later), so these mirror the EN
  -- names above but tracked as separate catalog entries under language 'jp'
  -- since a booster box is printed as either the JP or EN version.
  ('OP-01 Romance Dawn', 'one_piece', 'jp'), ('OP-02 Paramount War', 'one_piece', 'jp'),
  ('OP-03 Pillars of Strength', 'one_piece', 'jp'), ('OP-04 Kingdoms of Intrigue', 'one_piece', 'jp'),
  ('OP-05 Awakening of the New Era', 'one_piece', 'jp'), ('OP-06 Wings of the Captain', 'one_piece', 'jp'),
  ('OP-07 500 Years Into the Future', 'one_piece', 'jp'), ('OP-08 Two Legends', 'one_piece', 'jp'),
  ('OP-09 Emperors in the New World', 'one_piece', 'jp'), ('OP-10 Royal Blood', 'one_piece', 'jp'),
  ('OP-11 A Fist of Divine Speed', 'one_piece', 'jp'), ('OP-12 Legacy of the Master', 'one_piece', 'jp'),
  ('OP-13 Carrying On His Will', 'one_piece', 'jp'), ('OP-14 The Azure Sea''s Seven', 'one_piece', 'jp'),
  ('OP-15 Adventure on Kami''s Island', 'one_piece', 'jp'), ('OP-16 The Time of Battle', 'one_piece', 'jp')
on conflict (name, brand, language) do nothing;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  tags text[] not null default '{}',
  image_url text,
  brand text check (brand in ('pokemon', 'one_piece')),
  set_id uuid references card_sets(id) on delete set null,
  -- Shown in the storefront's featured carousels (set from /storefront in the ERP).
  -- Sections are generic slots (see storefront_sections for their display
  -- titles) rather than fixed categories, since what goes in them may change.
  -- The _order columns control carousel display order within each section —
  -- null when not featured, otherwise a per-section rank assigned on toggle-on
  -- and adjusted by the reorder up/down controls.
  featured_section_1 boolean not null default false,
  featured_section_1_order integer,
  featured_section_2 boolean not null default false,
  featured_section_2_order integer,
  -- "Make an offer" (see the offers table): whether the PDP shows the offer
  -- button at all, and the staff-only reference floor shown when reviewing
  -- an incoming offer in the admin Offers page (never shown to customers).
  offers_enabled boolean not null default false,
  offer_min_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_products_updated_at on products;
create trigger set_products_updated_at
  before update on products
  for each row execute function set_updated_at();

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  name text,
  date date,
  inter_shipping numeric not null default 0,
  forwarding numeric not null default 0,
  local_cargo numeric not null default 0,
  payment_fee numeric not null default 0,
  other_expense numeric not null default 0,
  deduction numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists inventory_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  qty numeric not null,
  cost numeric not null,
  fee_pct numeric not null default 18,
  add_up_pct numeric not null default 15,
  acquired_date date,
  locked boolean not null default false,
  purchase_id uuid references purchases(id) on delete set null,
  created_at timestamptz not null default now(),
  -- null = track the default (115% of cost); a stored value is a manual
  -- override the "Reset" button clears back to null.
  direct_price numeric,
  -- Which batch's direct_price the storefront shows for this product — at
  -- most one per product, enforced below.
  is_storefront_price boolean not null default false,
  -- Pre-order estimate is either a fixed arrival date OR a duration in days
  -- counted from when the customer orders — mutually exclusive, set by
  -- app/products/[id]/ProductBatches.tsx. When is_preorder is true and
  -- neither is set, the app falls back to a 30-day default.
  is_preorder boolean not null default false,
  preorder_duration_days integer,
  preorder_arrival_date date,
  -- Caps how many of this batch's units the storefront can sell, separate
  -- from the physical qty — e.g. qty=5 but only 4 should ever go out via
  -- the storefront, holding the rest back for marketplace/manual orders.
  -- Null = no cap (storefront can sell up to the full physical qty).
  storefront_qty_limit numeric
);

create unique index if not exists one_storefront_price_per_product
  on inventory_batches (product_id) where is_storefront_price;

create table if not exists purchase_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  product_id uuid not null references products(id),
  qty numeric not null,
  unit_cost numeric not null,
  exclude_cost boolean not null default false,
  use_custom_landed_cost boolean not null default false,
  custom_landed_cost numeric,
  pushed boolean not null default false,
  inventory_batch_id uuid references inventory_batches(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Storefront customer accounts — a lightweight auth system deliberately kept
-- separate from Supabase Auth (used only for ERP staff sign-in). Reusing
-- Supabase Auth here would mean every logged-in customer inherits the
-- 'authenticated' role that the RLS policies below grant full ERP access to,
-- so these tables have NO RLS policies at all — every read/write goes
-- through the service-role client from app/actions/customer.ts and
-- lib/customerAuth.ts, gated by the app's own session-cookie check instead
-- of a Supabase session.
-- Deliberately no address column here — as a small shop we'd rather not hold
-- onto customers' home addresses beyond what each order itself needs (see
-- customer_address on the orders table, captured fresh at every checkout).
-- If your database still has an address column from before this change, the
-- app no longer reads or writes it; drop it yourself when you're ready:
--   alter table customers drop column if exists address;
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  name text,
  phone text,
  -- "Forgot password" flow (see requestPasswordReset/resetPasswordWithToken
  -- in app/actions/customer.ts) — same shape as offers.checkout_token.
  reset_token text unique,
  reset_token_expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Existing databases created before the reset-token columns existed.
alter table customers add column if not exists reset_token text unique;
alter table customers add column if not exists reset_token_expires_at timestamptz;

create table if not exists customer_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists wishlist_items (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

-- One row per storefront product-detail-page view (app/actions/storefront.ts
-- recordProductView) — anonymous, no visitor/session identity, just enough
-- to compute "most viewed" over a time window for a future "People often
-- visit" section. Not recorded in local dev (see recordProductView).
create table if not exists product_views (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists product_views_product_id_idx on product_views (product_id);
create index if not exists product_views_viewed_at_idx on product_views (viewed_at);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_id text unique not null,
  channel text check (channel in ('tokopedia','shopee','website','direct')),
  date timestamptz,
  order_url text,
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  -- J&T Express AWB/resi number, entered manually once a package ships.
  -- Looked up via Biteship on the public /store/track page to show live
  -- courier status.
  awb text,
  -- Set on storefront checkout (app/actions/checkout.ts) — orders created
  -- from the ERP directly (Tokopedia/Shopee imports) leave these null.
  customer_name text,
  customer_phone text,
  customer_address text,
  -- Used to send the order-lifecycle emails (lib/email.ts): confirmation,
  -- payment confirmed, shipped, cancellation/refund updates.
  customer_email text,
  -- Distinct from `status` (fulfillment) — this tracks the Midtrans payment
  -- lifecycle and is updated by the /api/midtrans/notification webhook and
  -- the cancellation-refund flow in app/actions/orders.ts.
  -- refund_pending = approved for cancellation but Midtrans can't refund the
  -- payment method automatically (bank transfer VA) — staff must wire the
  -- money back manually, then mark it refunded.
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','pending','paid','failed','expired','refund_pending','refunded')),
  payment_method text,
  -- Payment-method-specific details to show the customer (VA number + bank,
  -- or a QRIS image URL) plus the Midtrans transaction_id, e.g.
  -- {"transaction_id": "...", "va_number": "12345", "bank": "bca"}.
  payment_details jsonb,
  -- Set when the order was placed while signed into a storefront account
  -- (app/actions/checkout.ts). Null for guest checkouts.
  customer_id uuid references customers(id) on delete set null,
  -- Customer-initiated cancellation request (app/actions/customer.ts) —
  -- requires staff approval (app/actions/orders.ts) before status actually
  -- becomes 'cancelled', per the business requirement that cancellation
  -- isn't automatic.
  cancellation_requested_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now()
);

create table if not exists order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  inventory_batch_id uuid references inventory_batches(id),
  price numeric,
  created_at timestamptz not null default now()
);

-- Customer "make an offer" submissions on products with offers_enabled.
-- Staff approve/reject from the admin Offers page; approving mints a
-- one-time checkout_token that lets the customer pay at the offered price
-- through /store/offers/[token] (app/actions/offers.ts), independent of the
-- product's normal storefront price and normal cart checkout.
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  -- Set when the offer was submitted while signed into a storefront account
  -- (mirrors orders.customer_id). Null for guest offers.
  customer_id uuid references customers(id) on delete set null,
  customer_name text,
  customer_email text not null,
  offered_price numeric not null,
  qty integer not null default 1,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','expired','completed')),
  checkout_token text unique,
  token_expires_at timestamptz,
  responded_at timestamptz,
  -- Set once the customer completes payment through the offer checkout link.
  order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Customer requests for a specific card that isn't in the catalog yet (e.g.
-- "PSA 10 Charizard VMAX"). Unlike offers (which need an existing product),
-- customers describe what they want in free text; staff manually price it —
-- optionally referencing a SNKRDUNK listing pasted into snkrdunk_url — then
-- quoting creates a one-off product row (so the normal order_lines/orders
-- pipeline is reused unchanged) and mints a checkout_token the same way
-- approveOffer does, letting the customer pay through /store/requests/[token].
create table if not exists card_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  customer_name text,
  customer_email text not null,
  customer_phone text,
  card_name text not null,
  set_name text,
  grade text,
  -- Customer-supplied link/photo showing which exact card they want.
  reference_url text,
  notes text,
  qty integer not null default 1,
  status text not null default 'pending'
    check (status in ('pending','quoted','rejected','expired','completed')),
  quoted_price numeric,
  -- SNKRDUNK listing the admin priced this against, pasted in at quote time.
  snkrdunk_url text,
  -- One-off product row created at quote time so orders/order_lines work
  -- unchanged; null until quoted.
  product_id uuid references products(id) on delete set null,
  checkout_token text unique,
  token_expires_at timestamptz,
  responded_at timestamptz,
  order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists cash (
  id uuid primary key default gen_random_uuid(),
  date timestamptz,
  payment_type text check (payment_type in ('incoming','outgoing')),
  source_destination text,
  amount numeric,
  name text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  value numeric,
  deposit numeric,
  tokopedia numeric,
  shopee numeric,
  created_at timestamptz not null default now()
);

-- Bank income/outgoing ledger — not migrated from Strapi, entered fresh going
-- forward. Has its own app page (/balance).
-- Add a "beginning balance" as the first row (type 'in', no counterpart
-- transaction), then further entries as they happen.
create table if not exists balances (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  type text check (type in ('in','out')),
  category text check (category in (
    'shopee_payout','tokopedia_payout','direct_payout','expenses','deposit',
    'withdrawal','stock_purchase','shipping','ads'
  )),
  amount numeric not null,
  name text,
  notes text,
  created_at timestamptz not null default now()
);

-- Singleton row: marketplace balances not yet transferred out to the bank.
-- Manually updated periodically by the admin (no automated sync) — surfaced
-- as editable fields in the Dashboard's Total Value box.
create table if not exists marketplace_balances (
  id uuid primary key default gen_random_uuid(),
  shopee_to_settle numeric not null default 0,
  tokopedia_to_settle numeric not null default 0,
  updated_at timestamptz not null default now()
);

insert into marketplace_balances (shopee_to_settle, tokopedia_to_settle)
  select 0, 0 where not exists (select 1 from marketplace_balances);

-- Display titles for the storefront's featured carousel slots (set from
-- /storefront in the ERP). id matches the products.featured_* column it
-- controls, so lookups need no extra mapping.
create table if not exists storefront_sections (
  id text primary key,
  title text not null
);

insert into storefront_sections (id, title) values
  ('featured_section_1', 'Section 1'),
  ('featured_section_2', 'Section 2')
on conflict (id) do nothing;

-- Singleton row (id is always 1) for storefront-wide editable copy: the
-- tagline shown next to the logo in StoreHeader, and the rotating messages
-- in AnnouncementBar (one per line in the admin textarea, stored as an
-- array so the bar can keep rotating through several).
create table if not exists storefront_settings (
  id integer primary key default 1,
  header_tagline text not null default 'Free shipping across Indonesia on every order',
  announcement_messages text[] not null default array[
    'We currently ship within Indonesia only',
    '100% authentic cards, checked before shipping'
  ],
  updated_at timestamptz not null default now(),
  constraint storefront_settings_singleton check (id = 1)
);

insert into storefront_settings (id) values (1) on conflict (id) do nothing;

-- Indonesia's official administrative regions (province -> city/regency ->
-- kecamatan -> kelurahan/desa), sourced from cahyadsn/wilayah (Kepmendagri
-- codes) via scripts/import-regions.ts. Powers the cascading address
-- selects at storefront checkout (app/store/AddressRegionSelect.tsx).
-- code encodes the hierarchy itself, e.g. "32" (province) -> "32.04" (city)
-- -> "32.04.05" (kecamatan) -> "32.04.05.2001" (kelurahan) — parent_code is
-- just that string with its last dot-segment removed, null for provinces.
-- No postal_code column: the source dataset doesn't carry one at village
-- level, so checkout collects it as a manual field instead.
create table if not exists regions (
  code text primary key,
  name text not null,
  parent_code text references regions(code)
);

create index if not exists regions_parent_code_idx on regions (parent_code);

-- Clickable chips under the storefront search box (set from /storefront in
-- the ERP).
create table if not exists popular_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  created_at timestamptz not null default now()
);

insert into popular_keywords (keyword)
  select v.keyword from (values
    ('Booster Box'), ('Graded'), ('ETB'), ('PSA 10'), ('Charizard')
  ) as v(keyword)
  where not exists (select 1 from popular_keywords);

-- Clickable image tiles under the storefront's search box (set from
-- /storefront in the ERP). href is the destination when clicked — for
-- entries built as a category filter or search query this is a /store URL
-- with query params (brand/setId/category/q) the storefront page already
-- knows how to apply client-side without a full reload; for a single-product
-- shortcut it's /store/products/{id}; for anything else it's whatever the
-- admin typed (e.g. an external link). image_url is uploaded to the
-- product-images bucket under a shortcuts/ prefix — see uploadStorefrontShortcutImage.
create table if not exists storefront_shortcuts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  href text not null,
  image_url text,
  -- Small corner badge shown on the shortcut chip on /store, e.g. to flag a
  -- promo or a newly-added category. Null means no badge.
  badge text check (badge in ('fire', 'new', 'sale')),
  created_at timestamptz not null default now()
);

-- Existing databases created before the badge column existed.
alter table storefront_shortcuts add column if not exists badge text;
alter table storefront_shortcuts drop constraint if exists storefront_shortcuts_badge_check;
alter table storefront_shortcuts add constraint storefront_shortcuts_badge_check
  check (badge in ('fire', 'new', 'sale'));

insert into storefront_shortcuts (label, href)
  select v.label, v.href from (values
    ('Pokemon', '/store?brand=pokemon'),
    ('One Piece', '/store?brand=one_piece'),
    ('Booster Boxes', '/store?category=booster_boxes'),
    ('Singles', '/store?category=singles'),
    ('Slabs', '/store?category=slabs')
  ) as v(label, href)
  where not exists (select 1 from storefront_shortcuts);

create table if not exists supplier_pricelist (
  id uuid primary key default gen_random_uuid(),
  category text,
  name text,
  flag text not null default 'none' check (flag in ('none','down','price_change')),
  price_jpy numeric,
  price_usd numeric,
  price_gbp numeric,
  price_eur numeric,
  price_cad numeric,
  price_aud numeric,
  price_sgd numeric,
  imported_at timestamptz,
  created_at timestamptz not null default now()
);

-- "Available" is derived from order_lines rather than stored as a counter,
-- so add/remove-line is a plain insert/delete with no read-modify-write race.
-- Lines on a cancelled order don't count against stock — cancellation frees
-- it back up instead of leaving it reserved forever.
--
-- storefront_available additionally enforces storefront_qty_limit: it's
-- capped by how many units have sold through the storefront specifically
-- (channel = 'website'), not by total sales, so a unit sold via a
-- marketplace/manual order still comes out of `available` for everyone but
-- doesn't eat into the storefront's own allowance.
--
-- Dropped and recreated rather than `create or replace` — `b.*` means any
-- column added to inventory_batches shifts the ordinal position of columns
-- listed after it, and `create or replace view` can't rename/reorder an
-- existing view column (only append past the end), so it errors instead.
drop view if exists inventory_batch_availability;
create view inventory_batch_availability as
  with sold as (
    select
      ol.inventory_batch_id,
      count(*) filter (where o.status <> 'cancelled') as total_sold,
      count(*) filter (where o.status <> 'cancelled' and o.channel = 'website') as storefront_sold
    from order_lines ol
    join orders o on o.id = ol.order_id
    group by ol.inventory_batch_id
  )
  select
    b.*,
    b.qty - coalesce(s.total_sold, 0) as available,
    case
      when b.storefront_qty_limit is null then b.qty - coalesce(s.total_sold, 0)
      else greatest(0, least(
        b.qty - coalesce(s.total_sold, 0),
        b.storefront_qty_limit - coalesce(s.storefront_sold, 0)
      ))
    end as storefront_available
  from inventory_batches b
  left join sold s on s.inventory_batch_id = b.id;

-- Row Level Security: internal tool, any authenticated user has full access.
-- Cash / snapshots / supplier_pricelist have no app pages and are meant to be
-- edited directly in Supabase Studio (which uses the service role and bypasses RLS).
alter table card_sets enable row level security;
alter table products enable row level security;
alter table purchases enable row level security;
alter table purchase_lines enable row level security;
alter table inventory_batches enable row level security;
alter table orders enable row level security;
alter table order_lines enable row level security;
-- Customer submissions (pending status) and the checkout-token lookup both
-- go through the service-role client, same as orders — staff review/approve
-- through the authenticated policy below.
alter table offers enable row level security;
-- Same pattern as offers: customer submission and checkout-token lookup go
-- through the service-role client, staff quote/reject through the policy below.
alter table card_requests enable row level security;
alter table cash enable row level security;
alter table snapshots enable row level security;
alter table supplier_pricelist enable row level security;
alter table balances enable row level security;
alter table marketplace_balances enable row level security;
alter table storefront_sections enable row level security;
alter table popular_keywords enable row level security;
alter table storefront_shortcuts enable row level security;
alter table storefront_settings enable row level security;
-- Read-only reference data, populated only by scripts/import-regions.ts
-- (service role, bypasses RLS) — no "authenticated full access" policy
-- needed since nothing in the ERP writes to it.
alter table regions enable row level security;
-- Customer accounts: RLS enabled with NO policies at all (see the comment
-- above the customers table) — default-deny for anon/authenticated, service
-- role only.
alter table customers enable row level security;
alter table customer_sessions enable row level security;
alter table wishlist_items enable row level security;
-- No policies here either — writes go through the service-role client in
-- recordProductView, reads through getMostViewedProducts.
alter table product_views enable row level security;

create policy "authenticated full access" on card_sets for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- Storefront (public, unauthenticated) needs to read set names for display.
create policy "public read access" on card_sets for select
  using (true);
create policy "authenticated full access" on products for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- Storefront (public, unauthenticated) needs read access to the catalog.
create policy "public read access" on products for select
  using (true);
create policy "authenticated full access" on purchases for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on purchase_lines for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on inventory_batches for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on orders for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on order_lines for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on offers for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on card_requests for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on cash for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on snapshots for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on supplier_pricelist for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on balances for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on marketplace_balances for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on storefront_sections for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- Storefront (public, unauthenticated) needs to read the section titles.
create policy "public read access" on storefront_sections for select
  using (true);
create policy "authenticated full access" on popular_keywords for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- Storefront (public, unauthenticated) needs to read the keyword chips.
create policy "public read access" on popular_keywords for select
  using (true);
create policy "authenticated full access" on storefront_shortcuts for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- Storefront (public, unauthenticated) needs to read the shortcut tiles.
create policy "public read access" on storefront_shortcuts for select
  using (true);
create policy "authenticated full access" on storefront_settings for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- Storefront (public, unauthenticated) needs to read the tagline/announcements.
create policy "public read access" on storefront_settings for select
  using (true);
-- Storefront (public, unauthenticated) needs to read regions for the
-- cascading address selects at checkout.
create policy "public read access" on regions for select
  using (true);

-- Storage bucket for product images (create it once here rather than clicking through the UI).
insert into storage.buckets (id, name, public)
  values ('product-images', 'product-images', true)
  on conflict (id) do nothing;

create policy "public read product images" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "authenticated write product images" on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');
create policy "authenticated update product images" on storage.objects for update
  using (bucket_id = 'product-images' and auth.role() = 'authenticated');
create policy "authenticated delete product images" on storage.objects for delete
  using (bucket_id = 'product-images' and auth.role() = 'authenticated');
