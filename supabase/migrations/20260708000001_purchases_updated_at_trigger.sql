create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger purchases_set_updated_at
before update on public.purchases
for each row execute function set_updated_at();

-- To make a permanently-free demo account (e.g. for sales demos), find the
-- account's id in Authentication -> Users and the VINtage subscription
-- product's id (select id from products where slug = 'vintage-monthly' or
-- similar), then run as the SQL editor (bypasses RLS as a superuser):
--
--   insert into purchases (user_id, customer_email, product_id, status)
--   values ('<demo-account-user-id>', '<demo-account-email>', '<vintage-product-id>', 'demo');
--
-- 'demo' is never touched by the Stripe webhook (which only ever matches
-- existing rows by stripe_subscription_id or stripe_checkout_session_id), so
-- it stays free forever until manually changed.
