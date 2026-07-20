-- Technician Productivity Analyzer: the $399 cost + staffing + forecast tool.
-- Sits above the $79 KPI dashboard (a single-store monitor) and below the $499
-- P&L Snapshot on the ladder. Priced on the full-year forecast, which is
-- deliberately NOT in the dashboard.
--
-- Stripe one-time $399 price (sandbox/test mode), created 2026-07-16.
--
-- This is the first NON-HTML product. It is an .xlsx, so get-download-link
-- serves it as a short-lived signed URL rather than stamping a per-buyer
-- watermark -- the watermark works by string-replacing a comment in HTML text,
-- which would corrupt a zip container like an xlsx. Access control is
-- unchanged (private bucket, only reachable after Stripe confirms payment).
--
-- Upload the file to the `digital-Products` bucket (capital P -- bucket ids are
-- case-sensitive) at exactly:
--   technician-productivity-analyzer/Torque_Technician_Productivity_Analyzer.xlsx
-- The download is named from the slug, so buyers receive
-- `technician-productivity-analyzer.xlsx`.
insert into public.products (slug, name, product_type, requires_account, stripe_price_id, storage_path, is_active)
values (
  'technician-productivity-analyzer',
  'Technician Productivity Analyzer',
  'one_time',
  false,
  'price_1TtttbFpYKBwzJBR0fQNyNf3',
  'technician-productivity-analyzer/Torque_Technician_Productivity_Analyzer.xlsx',
  true
)
on conflict (slug) do update
set name = excluded.name,
    product_type = excluded.product_type,
    requires_account = excluded.requires_account,
    stripe_price_id = excluded.stripe_price_id,
    storage_path = excluded.storage_path,
    is_active = excluded.is_active;
