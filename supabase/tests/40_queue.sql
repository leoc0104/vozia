begin;
select public.test_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'alice@example.com');

do $$
declare
  alice constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v uuid;
  d uuid;
  m record;
  n integer;
begin
  perform public.test_impersonate(alice);
  insert into public.videos (owner_id, title, source_type, source_url)
    values (alice, 'Alice talk', 'youtube', 'https://youtu.be/dQw4w9WgXcQ') returning id into v;
  insert into public.dubs (video_id, owner_id, target_language) values (v, alice, 'pt') returning id into d;
  perform public.test_reset();

  select count(*) into n from pgmq.q_dub_jobs;
  if n <> 1 then raise exception 'ASSERT expected 1 queued message, found %', n; end if;

  select * into m from pgmq.read('dub_jobs', 30, 1);
  if m.msg_id is null then raise exception 'ASSERT read returned nothing'; end if;
  if (m.message ->> 'dub_id')::uuid <> d then raise exception 'ASSERT message carries wrong dub id'; end if;
  if m.read_ct <> 1 then raise exception 'ASSERT read_ct should be 1, got %', m.read_ct; end if;

  -- invisible while being processed, visible again after the visibility timeout is shortened
  select count(*) into n from pgmq.read('dub_jobs', 30, 1);
  if n <> 0 then raise exception 'ASSERT message was read twice'; end if;
  perform pgmq.set_vt('dub_jobs', m.msg_id, 0);
  select count(*) into n from pgmq.read('dub_jobs', 30, 1);
  if n <> 1 then raise exception 'ASSERT message did not reappear after set_vt'; end if;

  perform pgmq.archive('dub_jobs', m.msg_id);
  select count(*) into n from pgmq.q_dub_jobs;
  if n <> 0 then raise exception 'ASSERT archive left the message in the queue'; end if;

  -- worker stage changes do not enqueue; a retry does
  update public.dubs set status = 'ingesting' where id = d;
  update public.dubs set status = 'failed', error_message = 'x' where id = d;
  select count(*) into n from pgmq.q_dub_jobs;
  if n <> 0 then raise exception 'ASSERT stage changes enqueued messages'; end if;

  perform public.test_impersonate(alice);
  perform public.retry_dub(d);
  perform public.test_reset();
  select count(*) into n from pgmq.q_dub_jobs;
  if n <> 1 then raise exception 'ASSERT retry did not enqueue, found %', n; end if;
end $$;
rollback;
