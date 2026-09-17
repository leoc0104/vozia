-- Supabase Queues (pgmq): every queued dub becomes a message the worker consumes.

create extension if not exists pgmq;

select pgmq.create('dub_jobs');

create or replace function public.enqueue_dub()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'queued' and (tg_op = 'INSERT' or old.status is distinct from 'queued') then
    perform pgmq.send('dub_jobs', jsonb_build_object('dub_id', new.id));
  end if;
  return new;
end;
$$;

create trigger dubs_enqueue after insert or update of status on public.dubs
  for each row execute function public.enqueue_dub();
