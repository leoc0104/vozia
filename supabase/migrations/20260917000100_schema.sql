-- Vozia core schema: profiles, videos, dubs, dub_segments.

create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  minutes_quota integer not null default 10 check (minutes_quota >= 0),
  minutes_used integer not null default 0 check (minutes_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Untitled video',
  source_type text not null check (source_type in ('upload', 'youtube')),
  source_url text,
  storage_path text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  thumbnail_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint videos_source_consistent check (
    (source_type = 'youtube' and source_url is not null)
    or (source_type = 'upload' and storage_path is not null)
  )
);

create index videos_owner_created_idx on public.videos (owner_id, created_at desc);

create table public.dubs (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  source_language text check (source_language is null or source_language ~ '^[a-z]{2,3}(-[A-Za-z]{2,4})?$'),
  target_language text not null check (target_language ~ '^[a-z]{2,3}(-[A-Za-z]{2,4})?$'),
  voice_mode text not null default 'clone' check (voice_mode in ('clone', 'stock')),
  stock_voice_id text,
  pipeline text check (pipeline is null or pipeline in ('staged', 'elevenlabs')),
  status text not null default 'queued' check (
    status in ('queued', 'ingesting', 'separating', 'transcribing', 'translating', 'synthesizing', 'muxing', 'dubbing', 'completed', 'failed')
  ),
  progress integer not null default 0 check (progress between 0 and 100),
  failed_stage text,
  error_message text,
  attempts integer not null default 0,
  provider_ref text,
  detected_language text,
  output_path text,
  dubbed_audio_path text,
  srt_original_path text,
  srt_translated_path text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dubs_stock_voice_required check (voice_mode <> 'stock' or stock_voice_id is not null),
  constraint dubs_video_language_unique unique (video_id, target_language)
);

create index dubs_owner_created_idx on public.dubs (owner_id, created_at desc);
create index dubs_video_idx on public.dubs (video_id);
create index dubs_status_idx on public.dubs (status);

create table public.dub_segments (
  id bigint generated always as identity primary key,
  dub_id uuid not null references public.dubs (id) on delete cascade,
  idx integer not null check (idx >= 0),
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null check (end_ms >= start_ms),
  speaker text,
  text text not null,
  translated_text text,
  constraint dub_segments_dub_idx_unique unique (dub_id, idx)
);

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger videos_set_updated_at before update on public.videos
  for each row execute function public.set_updated_at();
create trigger dubs_set_updated_at before update on public.dubs
  for each row execute function public.set_updated_at();

-- One profile per auth user, created when the user signs up (email or OAuth).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), '')
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
