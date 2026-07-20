-- Product catalog: only ever read by Edge Functions using the service-role
-- key, never queried directly by client code, so it needs no RLS policies
-- beyond enabling RLS itself (default-deny for anon/authenticated).
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  product_type text not null check (product_type in ('subscription', 'one_time')),
  requires_account boolean not null default false,
  stripe_price_id text not null unique,
  stripe_product_id text,
  storage_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

-- Generic ledger of who bought/subscribed to what. Shared by subscriptions
-- and one-time purchases alike.
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_email text not null,
  product_id uuid not null references public.products(id),
  stripe_customer_id text,
  stripe_checkout_session_id text unique,
  stripe_subscription_id text,
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchases_user_id_idx on public.purchases(user_id);
create index purchases_stripe_subscription_id_idx on public.purchases(stripe_subscription_id);

alter table public.purchases enable row level security;

create policy "users read own purchases" on public.purchases
  for select using (auth.uid() = user_id);

-- Seed the VINtage subscription prices (Stripe LIVE mode; live IDs set 2026-07-19).
insert into public.products (slug, name, product_type, requires_account, stripe_price_id, is_active)
values
  ('vintage-monthly', 'VINtage — Monthly', 'subscription', true, 'price_1TueX9FlDAiFcsK78HqiLNqF', true),
  ('vintage-annual', 'VINtage — Annual', 'subscription', true, 'price_1TueX7FlDAiFcsK7ZN15So4S', true);
