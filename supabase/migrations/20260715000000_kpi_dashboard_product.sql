-- Private bucket for paid digital-product downloads. Unlike dealer-logos,
-- this is NOT public and gets zero client-facing RLS policies -- the only
-- reader is get-download-link's service-role client, which bypasses RLS
-- entirely. Access control is: get-download-link verifies the Stripe session
-- is paid, then reads this file server-side, stamps the buyer's license line
-- in, and returns the HTML -- so the bucket policy is never the gate.
-- on conflict do nothing so this is safe whether or not the bucket was
-- already created by hand in the Storage UI. NOTE: the bucket id is
-- 'digital-Products' (capital P) because that's how it was created in the
-- Storage UI; bucket ids are case-sensitive and can't be renamed, so
-- everything (this line + get-download-link) matches that exact casing.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('digital-Products', 'digital-Products', false, 5242880, array['text/html'])
on conflict (id) do nothing;

-- Stripe one-time $79 price for "Service Dept. KPI Dashboard" (sandbox/test
-- mode), created 2026-07-15.
insert into public.products (slug, name, product_type, requires_account, stripe_price_id, storage_path, is_active)
values (
  'kpi-dashboard',
  'Service Dept. KPI Dashboard',
  'one_time',
  false,
  'price_1TtfImFpYKBwzJBRJGXA6etT',
  'kpi-dashboard/index.html',
  true
);
