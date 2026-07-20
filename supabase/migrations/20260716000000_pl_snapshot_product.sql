-- Fixed Ops P&L Snapshot: the $499 one-time "anchor" product that sits just
-- below consulting on the value ladder. Same shared commerce path as the KPI
-- dashboard -- no account required, delivered as a per-buyer watermarked
-- download by get-download-link.
--
-- Stripe one-time $499 price for "Fixed Ops P&L Snapshot" (Stripe LIVE mode; live ID set 2026-07-19),
-- created 2026-07-16.
--
-- The file must be uploaded to the `digital-Products` bucket (capital P --
-- bucket ids are case-sensitive) at `dealer-pl-snapshot/index.html`.
insert into public.products (slug, name, product_type, requires_account, stripe_price_id, storage_path, is_active)
values (
  'dealer-pl-snapshot',
  'Fixed Ops P&L Snapshot',
  'one_time',
  false,
  'price_1TueX3FlDAiFcsK7nFXz8QEA',
  'dealer-pl-snapshot/index.html',
  true
)
on conflict (slug) do update
set name = excluded.name,
    product_type = excluded.product_type,
    requires_account = excluded.requires_account,
    stripe_price_id = excluded.stripe_price_id,
    storage_path = excluded.storage_path,
    is_active = excluded.is_active;
