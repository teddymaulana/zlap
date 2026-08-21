-- zlap-erp schema
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).

create extension if not exists "pgcrypto";

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  tags text[] not null default '{}',
  image_url text,
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
  created_at timestamptz not null default now()
);

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

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_id text unique not null,
  channel text check (channel in ('tokopedia','shopee','website','direct')),
  date timestamptz,
  order_url text,
  status text not null default 'pending' check (status in ('pending','completed')),
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
create or replace view inventory_batch_availability as
  select
    b.*,
    b.qty - coalesce(
      (select count(*) from order_lines ol where ol.inventory_batch_id = b.id),
      0
    ) as available
  from inventory_batches b;

-- Row Level Security: internal tool, any authenticated user has full access.
-- Cash / snapshots / supplier_pricelist have no app pages and are meant to be
-- edited directly in Supabase Studio (which uses the service role and bypasses RLS).
alter table products enable row level security;
alter table purchases enable row level security;
alter table purchase_lines enable row level security;
alter table inventory_batches enable row level security;
alter table orders enable row level security;
alter table order_lines enable row level security;
alter table cash enable row level security;
alter table snapshots enable row level security;
alter table supplier_pricelist enable row level security;
alter table balances enable row level security;
alter table marketplace_balances enable row level security;

create policy "authenticated full access" on products for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
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
