begin;
select public.test_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'alice@example.com');
select public.test_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bob@example.com');

do $$
declare
  alice constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  bob constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v uuid;
  d uuid;
  row public.dubs;
begin
  perform public.test_impersonate(alice);
  insert into public.videos (owner_id, title, source_type, source_url)
    values (alice, 'Alice talk', 'youtube', 'https://youtu.be/dQw4w9WgXcQ') returning id into v;

  -- client-provided worker columns are ignored
  insert into public.dubs (video_id, owner_id, target_language, status, progress, attempts, output_path, error_message)
    values (v, alice, 'pt', 'completed', 99, 7, 'evil/path.mp4', 'nope') returning id into d;
  select * into row from public.dubs where id = d;
  if row.status <> 'queued' or row.progress <> 0 or row.attempts <> 0 or row.output_path is not null or row.error_message is not null then
    raise exception 'ASSERT client insert was not sanitized: % % %', row.status, row.progress, row.attempts;
  end if;

  -- retry only works on own failed dubs
  begin
    perform public.retry_dub(d);
    raise exception 'ASSERT retried a queued dub';
  exception when others then
    if sqlerrm not like '%dub_not_retryable%' then raise; end if;
  end;

  perform public.test_reset();
  update public.dubs set status = 'failed', failed_stage = 'muxing', error_message = 'boom', progress = 90, attempts = 1 where id = d;

  perform public.test_impersonate(bob);
  begin
    perform public.retry_dub(d);
    raise exception 'ASSERT bob retried alice''s dub';
  exception when others then
    if sqlerrm not like '%dub_not_retryable%' then raise; end if;
  end;
  perform public.test_reset();

  perform public.test_impersonate(alice);
  perform public.retry_dub(d);
  select * into row from public.dubs where id = d;
  if row.status <> 'queued' or row.progress <> 0 or row.error_message is not null or row.failed_stage is not null or row.attempts <> 1 then
    raise exception 'ASSERT retry did not reset the dub: % % %', row.status, row.error_message, row.attempts;
  end if;
  perform public.test_reset();

  -- no minutes left: creation is blocked at the database
  update public.profiles set minutes_used = minutes_quota where id = alice;
  perform public.test_impersonate(alice);
  begin
    insert into public.dubs (video_id, owner_id, target_language) values (v, alice, 'es');
    raise exception 'ASSERT dub created without minutes';
  exception when others then
    if sqlerrm not like '%insufficient_minutes%' then raise; end if;
  end;
  perform public.test_reset();

  -- the worker (no JWT) can still write everything
  update public.dubs set status = 'ingesting', pipeline = 'staged', attempts = 2 where id = d;
  update public.dubs set status = 'completed', progress = 100, output_path = alice::text || '/' || d::text || '/dubbed.mp4' where id = d;
  if (select status from public.dubs where id = d) <> 'completed' then raise exception 'ASSERT service update failed'; end if;
end $$;
rollback;
