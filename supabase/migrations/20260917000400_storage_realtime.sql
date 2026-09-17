-- Private buckets with owner-scoped object policies, and realtime on dubs/videos.

insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'sources', 'sources', false,
  array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'image/jpeg']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'outputs', 'outputs', false,
  array['video/mp4', 'audio/wav', 'audio/x-wav', 'audio/wave', 'application/x-subrip', 'text/plain', 'text/srt']
)
on conflict (id) do nothing;

create policy sources_select_own on storage.objects
  for select to authenticated using (bucket_id = 'sources' and (storage.foldername(name))[1] = auth.uid()::text);
create policy sources_insert_own on storage.objects
  for insert to authenticated with check (bucket_id = 'sources' and (storage.foldername(name))[1] = auth.uid()::text);
create policy sources_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'sources' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'sources' and (storage.foldername(name))[1] = auth.uid()::text);
create policy sources_delete_own on storage.objects
  for delete to authenticated using (bucket_id = 'sources' and (storage.foldername(name))[1] = auth.uid()::text);

create policy outputs_select_own on storage.objects
  for select to authenticated using (bucket_id = 'outputs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy outputs_delete_own on storage.objects
  for delete to authenticated using (bucket_id = 'outputs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime: the UI subscribes to its own dubs/videos rows.
alter table public.dubs replica identity full;
alter table public.videos replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dubs'
    ) then
      alter publication supabase_realtime add table public.dubs;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'videos'
    ) then
      alter publication supabase_realtime add table public.videos;
    end if;
  end if;
end;
$$;
