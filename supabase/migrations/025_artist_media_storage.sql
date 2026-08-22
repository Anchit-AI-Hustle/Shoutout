-- 025 — Storage for artist media.
--
-- CLAUDE.md: "signed direct upload, never proxy media through the API".
-- Supabase Storage rather than R2 for now: it needs no additional vendor
-- account, and the upload path in apps/web is identical either way — the
-- route mints a signed URL and the browser PUTs to it directly.
--
-- Reads are public because artist profiles are public pages (the SEO
-- engine, docs/04-PROFILES.md). Writes are pinned to a path prefix equal
-- to the caller's org id, which makes the object path an authorisation
-- boundary rather than a naming convention — one org cannot overwrite
-- another's media even though everyone can read it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artist-media', 'artist-media', true, 26214400,
  array['image/jpeg','image/png','image/webp','image/avif',
        'audio/mpeg','audio/mp4','audio/wav','audio/aac'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "artist_media_insert_own_org" on storage.objects;
create policy "artist_media_insert_own_org" on storage.objects for insert to authenticated
with check (bucket_id = 'artist-media' and (storage.foldername(name))[1] = current_org_id()::text);

drop policy if exists "artist_media_update_own_org" on storage.objects;
create policy "artist_media_update_own_org" on storage.objects for update to authenticated
using (bucket_id = 'artist-media' and (storage.foldername(name))[1] = current_org_id()::text);

drop policy if exists "artist_media_delete_own_org" on storage.objects;
create policy "artist_media_delete_own_org" on storage.objects for delete to authenticated
using (bucket_id = 'artist-media' and (storage.foldername(name))[1] = current_org_id()::text);

drop policy if exists "artist_media_public_read" on storage.objects;
create policy "artist_media_public_read" on storage.objects for select to anon, authenticated
using (bucket_id = 'artist-media');
