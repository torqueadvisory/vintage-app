-- Lightweight, cookie-free traffic analytics for the marketing site.
--
-- Deliberately stores NO personal data: no IP address, no cookie, no device
-- fingerprint, no user id. That keeps it outside consent-banner territory and
-- consistent with the published privacy policy, and it means a leak would
-- expose nothing sensitive. What it does capture is what actually matters for
-- marketing attribution: which page, where the visitor came from, and the UTM
-- tags on the link they clicked.
--
-- Bot filtering is largely free: this is written by a browser script, and most
-- crawlers never execute JS.
create table if not exists public.page_views (
  id           bigint generated always as identity primary key,
  path         text not null,
  referrer     text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  viewport_w   integer,
  created_at   timestamptz not null default now()
);

create index if not exists page_views_created_at_idx on public.page_views (created_at desc);
create index if not exists page_views_path_idx       on public.page_views (path);

alter table public.page_views enable row level security;

-- The site is public, so the browser writes with the anon (publishable) key.
-- INSERT only: anon can add a view but can never read the table back, so the
-- traffic data is not world-readable. Reads happen with the service role.
drop policy if exists "anon can record a page view" on public.page_views;
create policy "anon can record a page view"
  on public.page_views for insert
  to anon
  with check (true);
