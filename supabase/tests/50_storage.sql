begin;
select public.test_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'alice@example.com');
select public.test_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bob@example.com');

do $$
declare
  alice constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  bob constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  n integer;
begin
  if (select count(*) from storage.buckets where id in ('sources', 'outputs') and public = false) <> 2 then
    raise exception 'ASSERT private buckets missing';
  end if;

  perform public.test_impersonate(alice);
  insert into storage.objects (bucket_id, name) values ('sources', alice::text || '/video-1/original.mp4');

  begin
    insert into storage.objects (bucket_id, name) values ('sources', bob::text || '/video-1/original.mp4');
    raise exception 'ASSERT alice wrote into bob''s folder';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects (bucket_id, name) values ('outputs', alice::text || '/dub-1/dubbed.mp4');
    raise exception 'ASSERT alice wrote an output object';
  exception when insufficient_privilege then null;
  end;
  perform public.test_reset();

  insert into storage.objects (bucket_id, name) values ('outputs', alice::text || '/dub-1/dubbed.mp4');
  insert into storage.objects (bucket_id, name) values ('outputs', bob::text || '/dub-2/dubbed.mp4');

  perform public.test_impersonate(alice);
  select count(*) into n from storage.objects where bucket_id = 'outputs';
  if n <> 1 then raise exception 'ASSERT alice sees % output objects', n; end if;
  delete from storage.objects where bucket_id = 'outputs' and name like bob::text || '/%';
  perform public.test_reset();
  select count(*) into n from storage.objects where bucket_id = 'outputs';
  if n <> 2 then raise exception 'ASSERT alice deleted bob''s output'; end if;
end $$;
rollback;
