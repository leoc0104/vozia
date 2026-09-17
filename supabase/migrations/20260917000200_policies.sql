-- Row level security, owner-only access, credit enforcement and the retry RPC.

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.dubs enable row level security;
alter table public.dub_segments enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.videos to authenticated;
grant select, insert, delete on public.dubs to authenticated;
grant select on public.dub_segments to authenticated;
grant all on public.profiles, public.videos, public.dubs, public.dub_segments to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- profiles: owners read and edit their own row, but never their credit columns.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.profiles_protect_quota()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null
     and (new.minutes_quota is distinct from old.minutes_quota
          or new.minutes_used is distinct from old.minutes_used) then
    raise exception 'quota_columns_readonly'
      using hint = 'Dubbing minutes are managed by the platform';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_quota before update on public.profiles
  for each row execute function public.profiles_protect_quota();

-- videos: owner-only; client-provided object paths must live in the owner's folder.
create policy videos_select_own on public.videos
  for select to authenticated using (owner_id = auth.uid());
create policy videos_insert_own on public.videos
  for insert to authenticated with check (
    owner_id = auth.uid()
    and (storage_path is null or storage_path like auth.uid()::text || '/%')
    and (thumbnail_path is null or thumbnail_path like auth.uid()::text || '/%')
  );
create policy videos_update_own on public.videos
  for update to authenticated using (owner_id = auth.uid()) with check (
    owner_id = auth.uid()
    and (storage_path is null or storage_path like auth.uid()::text || '/%')
    and (thumbnail_path is null or thumbnail_path like auth.uid()::text || '/%')
  );
create policy videos_delete_own on public.videos
  for delete to authenticated using (owner_id = auth.uid());

-- dubs: owners create and delete; the only owner-initiated change is retry_dub().
create policy dubs_select_own on public.dubs
  for select to authenticated using (owner_id = auth.uid());
create policy dubs_insert_own on public.dubs
  for insert to authenticated with check (
    owner_id = auth.uid()
    and exists (select 1 from public.videos v where v.id = video_id and v.owner_id = auth.uid())
  );
create policy dubs_delete_own on public.dubs
  for delete to authenticated using (owner_id = auth.uid());

create policy dub_segments_select_own on public.dub_segments
  for select to authenticated using (
    exists (select 1 from public.dubs d where d.id = dub_id and d.owner_id = auth.uid())
  );

-- Client inserts are sanitized and credit-checked; service/worker inserts (no JWT) are trusted.
create or replace function public.dubs_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quota integer;
  used integer;
begin
  if auth.uid() is null then
    return new;
  end if;

  new.status := 'queued';
  new.progress := 0;
  new.attempts := 0;
  new.pipeline := null;
  new.failed_stage := null;
  new.error_message := null;
  new.provider_ref := null;
  new.detected_language := null;
  new.output_path := null;
  new.dubbed_audio_path := null;
  new.srt_original_path := null;
  new.srt_translated_path := null;
  new.started_at := null;
  new.completed_at := null;

  select p.minutes_quota, p.minutes_used into quota, used
  from public.profiles p where p.id = new.owner_id;

  if quota is null then
    raise exception 'profile_missing';
  end if;
  if used >= quota then
    raise exception 'insufficient_minutes'
      using hint = 'You have used all your dubbing minutes';
  end if;

  return new;
end;
$$;

create trigger dubs_before_insert before insert on public.dubs
  for each row execute function public.dubs_before_insert();

create or replace function public.retry_dub(p_dub_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.dubs
  set status = 'queued',
      progress = 0,
      failed_stage = null,
      error_message = null,
      started_at = null,
      completed_at = null
  where id = p_dub_id
    and owner_id = auth.uid()
    and status = 'failed';

  if not found then
    raise exception 'dub_not_retryable'
      using hint = 'Only your own failed dubs can be retried';
  end if;
end;
$$;

revoke all on function public.retry_dub(uuid) from public;
grant execute on function public.retry_dub(uuid) to authenticated;
