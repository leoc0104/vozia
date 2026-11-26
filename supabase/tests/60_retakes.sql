begin;
select public.test_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'alice@example.com');
select public.test_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bob@example.com');

do $$
declare
  alice constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  bob constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v uuid;
  d uuid;
  r uuid;
  m record;
  n integer;
  row public.dub_retakes;
begin
  perform public.test_impersonate(alice);
  insert into public.videos (owner_id, title, source_type, source_url)
    values (alice, 'Alice talk', 'youtube', 'https://youtu.be/dQw4w9WgXcQ') returning id into v;
  insert into public.dubs (video_id, owner_id, target_language) values (v, alice, 'pt') returning id into d;

  -- a dub that is not finished cannot be re-taken
  begin
    perform public.request_retake(d, 0, 'Olá');
    raise exception 'ASSERT re-took a queued dub';
  exception when others then
    if sqlerrm not like '%dub_not_retakeable%' then raise; end if;
  end;

  -- the worker finishes the dub with one line
  perform public.test_reset();
  delete from pgmq.q_dub_jobs;
  update public.dubs set status = 'completed', pipeline = 'staged', progress = 100 where id = d;
  insert into public.dub_segments (dub_id, idx, start_ms, end_ms, text, translated_text) values (d, 0, 0, 1000, 'Hello', 'Olá');

  -- only the owner, only an existing line, only real words
  perform public.test_impersonate(bob);
  begin
    perform public.request_retake(d, 0, 'Oi');
    raise exception 'ASSERT bob re-took alice''s dub';
  exception when others then
    if sqlerrm not like '%dub_not_retakeable%' then raise; end if;
  end;
  perform public.test_impersonate(alice);
  begin
    perform public.request_retake(d, 5, 'Oi');
    raise exception 'ASSERT re-took a line that does not exist';
  exception when others then
    if sqlerrm not like '%line_not_found%' then raise; end if;
  end;
  begin
    perform public.request_retake(d, 0, '   ');
    raise exception 'ASSERT re-took a line with no words';
  exception when others then
    if sqlerrm not like '%retake_text_invalid%' then raise; end if;
  end;

  -- a re-take is recorded and queued for the worker
  r := public.request_retake(d, 0, '  Oi, gente!  ');
  select * into row from public.dub_retakes where id = r;
  if row.text <> 'Oi, gente!' or row.status <> 'queued' or row.owner_id <> alice or row.idx <> 0 then
    raise exception 'ASSERT re-take recorded wrong: % % %', row.text, row.status, row.idx;
  end if;
  perform public.test_reset();
  select * into m from pgmq.read('dub_jobs', 30, 1);
  if (m.message ->> 'dub_id')::uuid <> d or (m.message ->> 'retake_id')::uuid <> r then
    raise exception 'ASSERT re-take message carries %', m.message;
  end if;

  -- one at a time
  perform public.test_impersonate(alice);
  begin
    perform public.request_retake(d, 0, 'Oi de novo');
    raise exception 'ASSERT queued a second re-take while one runs';
  exception when others then
    if sqlerrm not like '%retake_in_progress%' then raise; end if;
  end;

  -- the owner sees their re-takes, but cannot write them; others see nothing
  select count(*) into n from public.dub_retakes where dub_id = d;
  if n <> 1 then raise exception 'ASSERT owner sees % re-takes', n; end if;
  begin
    update public.dub_retakes set status = 'done' where id = r;
    raise exception 'ASSERT owner updated a re-take';
  exception when insufficient_privilege then null;
  end;
  perform public.test_impersonate(bob);
  select count(*) into n from public.dub_retakes;
  if n <> 0 then raise exception 'ASSERT bob sees % re-takes', n; end if;
  perform public.test_reset();
end $$;
rollback;
