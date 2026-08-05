-- Storage bucket for scanned repair/recon receipts. Each receipt lives at
-- `{auth.uid()}/{vehicle_id}/{timestamp}.jpg` -- multiple receipts per vehicle,
-- named by capture time so the app can show "Receipt - Aug 5" without a DB
-- column (same derive-from-path pattern as vehicle-photos and dealer-logos).
--
-- PRIVATE, unlike vehicle-photos: receipts are financial documents with vendor
-- names and dollar amounts. The app reads them through short-lived signed URLs,
-- which the owner-scoped select policy below authorizes.
--
-- storage.objects has RLS enabled by default with ZERO policies (the recurring
-- trap): every new bucket needs its policies stated explicitly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "users view own receipts" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users upload own receipts" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete own receipts" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
