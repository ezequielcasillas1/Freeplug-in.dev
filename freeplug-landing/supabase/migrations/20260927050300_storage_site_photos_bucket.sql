-- Private storage bucket for outreach screenshots and customer photos.
--
-- Files are written only by the server (service role, which bypasses storage RLS) after the
-- content checks in src/lib/outreach/image.ts (magic bytes, sharp re-encode, random names). They
-- are shown only through short-lived signed URLs after the token / session check.
-- The bucket limits below are a second layer only (they trust the declared type).
-- The restrictive policy keeps anon / authenticated out of this bucket even if a broad permissive
-- storage policy is added later.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('outreach', 'outreach', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "outreach_bucket_server_only" on storage.objects;
create policy "outreach_bucket_server_only"
  on storage.objects
  as restrictive
  for all
  to anon, authenticated
  using (bucket_id <> 'outreach')
  with check (bucket_id <> 'outreach');
