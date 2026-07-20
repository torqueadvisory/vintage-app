-- Storage bucket for per-vehicle photos. Each photo lives at the
-- deterministic path `{auth.uid()}/{vehicle_id}.jpg` -- no database column
-- tracks it (same pattern as dealer-logos): the app reconstructs the public
-- URL from ids it already has and falls back to a placeholder if the image
-- 404s. Photos are client-side downscaled to JPEG before upload, so the
-- 5MB limit is generous headroom, not an expectation.
--
-- storage.objects has RLS enabled by default with ZERO policies (the recurring
-- trap): every new bucket needs its policies stated explicitly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-photos',
  'vehicle-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "anyone can view vehicle photos" on storage.objects
  for select using (bucket_id = 'vehicle-photos');

create policy "users upload own vehicle photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vehicle-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users update own vehicle photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'vehicle-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'vehicle-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete own vehicle photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vehicle-photos' and (storage.foldername(name))[1] = auth.uid()::text);
