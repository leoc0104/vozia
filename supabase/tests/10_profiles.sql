begin;
select public.test_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'alice@example.com', '{"full_name": "Alice Doe", "avatar_url": "https://img/alice.png"}');
select public.test_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bob@example.com');

do $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if p.id is null then raise exception 'ASSERT profile trigger did not create alice'; end if;
  if p.display_name <> 'Alice Doe' then raise exception 'ASSERT display_name from metadata, got %', p.display_name; end if;
  if p.avatar_url <> 'https://img/alice.png' then raise exception 'ASSERT avatar from metadata'; end if;
  if p.minutes_quota <> 10 or p.minutes_used <> 0 then raise exception 'ASSERT default credits'; end if;

  select * into p from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if p.display_name <> 'bob' then raise exception 'ASSERT display_name falls back to email local part, got %', p.display_name; end if;
end $$;

-- owners see and edit only themselves
do $$
declare n integer;
begin
  perform public.test_impersonate('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'ASSERT alice sees % profiles', n; end if;

  update public.profiles set display_name = 'Alice D.' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if (select display_name from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 'Alice D.' then
    raise exception 'ASSERT alice could not rename herself';
  end if;

  update public.profiles set display_name = 'Hacked' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  perform public.test_reset();
  if (select display_name from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') <> 'bob' then
    raise exception 'ASSERT alice renamed bob';
  end if;
end $$;

-- credit columns are read-only for clients, writable for the service
do $$
begin
  perform public.test_impersonate('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  begin
    update public.profiles set minutes_quota = 9999 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    raise exception 'ASSERT alice raised her own quota';
  exception when others then
    if sqlerrm not like '%quota_columns_readonly%' then raise; end if;
  end;
  perform public.test_reset();
  update public.profiles set minutes_used = minutes_used + 3 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if (select minutes_used from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 3 then
    raise exception 'ASSERT service could not charge minutes';
  end if;
end $$;
rollback;
