-- Re-takes: the owner of a finished dub asks for one line to be performed again, with new words. The worker records
-- the line again and remixes the dub from what the first run kept; the dub stays playable meanwhile.

create table public.dub_retakes (
  id uuid primary key default gen_random_uuid(),
  dub_id uuid not null references public.dubs (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  idx integer not null check (idx >= 0),
  text text not null check (char_length(text) between 1 and 2000),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dub_retakes_dub_idx on public.dub_retakes (dub_id, created_at desc);

create trigger dub_retakes_set_updated_at before update on public.dub_retakes
  for each row execute function public.set_updated_at();

alter table public.dub_retakes enable row level security;

create policy dub_retakes_select_own on public.dub_retakes
  for select to authenticated
  using (owner_id = auth.uid());

revoke all on public.dub_retakes from anon, authenticated;
grant select on public.dub_retakes to authenticated;
grant all on public.dub_retakes to service_role;

create or replace function public.request_retake(p_dub_id uuid, p_idx integer, p_text text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_text text := btrim(coalesce(p_text, ''));
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.dubs d
    where d.id = p_dub_id and d.owner_id = auth.uid() and d.status = 'completed' and d.pipeline = 'staged'
  ) then
    raise exception 'dub_not_retakeable'
      using hint = 'Only lines of your own finished dubs can be re-taken';
  end if;
  if not exists (select 1 from public.dub_segments s where s.dub_id = p_dub_id and s.idx = p_idx) then
    raise exception 'line_not_found';
  end if;
  if char_length(v_text) = 0 or char_length(v_text) > 2000 then
    raise exception 'retake_text_invalid';
  end if;
  if exists (select 1 from public.dub_retakes r where r.dub_id = p_dub_id and r.status in ('queued', 'running')) then
    raise exception 'retake_in_progress'
      using hint = 'Wait for the line being re-taken to finish';
  end if;

  insert into public.dub_retakes (dub_id, owner_id, idx, text)
    values (p_dub_id, auth.uid(), p_idx, v_text)
    returning id into v_id;
  perform pgmq.send('dub_jobs', jsonb_build_object('dub_id', p_dub_id, 'retake_id', v_id));
  return v_id;
end;
$$;

revoke all on function public.request_retake(uuid, integer, text) from public;
grant execute on function public.request_retake(uuid, integer, text) to authenticated;

-- What a finished dub keeps for re-takes lives next to its outputs: its state as JSON and its chosen takes as MP3.
update storage.buckets
set allowed_mime_types = array(select distinct unnest(allowed_mime_types || array['audio/mpeg', 'application/json']))
where id = 'outputs';
