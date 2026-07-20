-- Storage bucket for dealer logo uploads. Each dealer's logo lives at a
-- deterministic path `{auth.uid()}/logo` -- no database table/column is
-- needed to track it, since the app always reconstructs the public URL
-- from the signed-in user's id and falls back to plain text if nothing
-- exists at that path.
--
-- storage.objects has RLS enabled by default with ZERO policies, which
-- silently blocks all access until policies are added explicitly (the same
-- trap hit with products/purchases -- see 20260709000000_products_readable.sql).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dealer-logos',
  'dealer-logos',
  true,
  3145728,
  array['image/png', 'image/jpeg', 'image/webp']
);

create policy "anyone can view dealer logos" on storage.objects
  for select using (bucket_id = 'dealer-logos');

create policy "users upload own logo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dealer-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users update own logo" on storage.objects
  for update to authenticated
  using (bucket_id = 'dealer-logos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'dealer-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete own logo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dealer-logos' and (storage.foldername(name))[1] = auth.uid()::text);
