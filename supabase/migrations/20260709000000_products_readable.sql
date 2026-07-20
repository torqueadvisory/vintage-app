-- getActiveSubscription() in src/api/subscription.js joins purchases to
-- products (products!inner(product_type)) using the caller's own session,
-- not the service role. Without a SELECT policy here, RLS silently hides
-- every products row from that join, which filters out every purchase row
-- too (inner join) -- so no signed-in user could ever be detected as
-- subscribed, regardless of actual payment status. Exposing the active
-- product catalog itself isn't sensitive (same info as a public pricing
-- page), so this is a safe, minimal fix.
create policy "anyone can read active products" on public.products
  for select using (is_active = true);
