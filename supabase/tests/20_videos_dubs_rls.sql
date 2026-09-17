begin;
select public.test_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'alice@example.com');
select public.test_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bob@example.com');

do $$
declare
  alice constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  bob constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_alice uuid;
  v_bob uuid;
  d_alice uuid;
  n integer;
begin
  -- alice creates a youtube video and an upload video in her own folder
  perform public.test_impersonate(alice);
  insert into public.videos (owner_id, title, source_type, source_url)
    values (alice, 'Alice talk', 'youtube', 'https://youtu.be/dQw4w9WgXcQ') returning id into v_alice;
  insert into public.videos (owner_id, title, source_type, storage_path)
    values (alice, 'Alice upload', 'upload', alice::text || '/some-video/original.mp4');

  begin
    insert into public.videos (owner_id, title, source_type, storage_path)
      values (alice, 'Sneaky', 'upload', bob::text || '/x/original.mp4');
    raise exception 'ASSERT alice stored a video under bob''s folder';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.videos (owner_id, title, source_type, source_url)
      values (bob, 'Forged', 'youtube', 'https://youtu.be/dQw4w9WgXcQ');
    raise exception 'ASSERT alice inserted a video owned by bob';
  exception when insufficient_privilege then null;
  end;

  insert into public.dubs (video_id, owner_id, target_language) values (v_alice, alice, 'pt') returning id into d_alice;
  perform public.test_reset();

  -- bob sees nothing of alice's and cannot attach a dub to her video
  perform public.test_impersonate(bob);
  select count(*) into n from public.videos;
  if n <> 0 then raise exception 'ASSERT bob sees % of alice videos', n; end if;
  select count(*) into n from public.dubs;
  if n <> 0 then raise exception 'ASSERT bob sees % of alice dubs', n; end if;

  insert into public.videos (owner_id, title, source_type, source_url)
    values (bob, 'Bob talk', 'youtube', 'https://youtu.be/dQw4w9WgXcQ') returning id into v_bob;
  begin
    insert into public.dubs (video_id, owner_id, target_language) values (v_alice, bob, 'es');
    raise exception 'ASSERT bob attached a dub to alice''s video';
  exception when insufficient_privilege then null;
  end;

  -- owners cannot update dubs directly
  begin
    update public.dubs set status = 'completed' where id = d_alice;
    raise exception 'ASSERT bob updated a dub';
  exception when insufficient_privilege then null;
  end;
  perform public.test_reset();

  perform public.test_impersonate(alice);
  begin
    update public.dubs set status = 'completed' where id = d_alice;
    raise exception 'ASSERT alice updated her dub directly';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.dubs where id = d_alice;
  if n <> 1 then raise exception 'ASSERT alice cannot see her dub'; end if;

  -- segments are readable by the owner only; written by the worker only
  perform public.test_reset();
  insert into public.dub_segments (dub_id, idx, start_ms, end_ms, text) values (d_alice, 0, 0, 1000, 'hi');
  perform public.test_impersonate(alice);
  select count(*) into n from public.dub_segments;
  if n <> 1 then raise exception 'ASSERT alice cannot read her segments'; end if;
  begin
    insert into public.dub_segments (dub_id, idx, start_ms, end_ms, text) values (d_alice, 1, 0, 1000, 'x');
    raise exception 'ASSERT alice inserted a segment';
  exception when insufficient_privilege then null;
  end;
  perform public.test_reset();
  perform public.test_impersonate(bob);
  select count(*) into n from public.dub_segments;
  if n <> 0 then raise exception 'ASSERT bob reads alice segments'; end if;
  perform public.test_reset();

  -- deleting a video cascades to its dubs and segments
  perform public.test_impersonate(alice);
  delete from public.videos where id = v_alice;
  perform public.test_reset();
  select count(*) into n from public.dubs where id = d_alice;
  if n <> 0 then raise exception 'ASSERT dub survived video deletion'; end if;
end $$;
rollback;
