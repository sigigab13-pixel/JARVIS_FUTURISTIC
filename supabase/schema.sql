-- JARVIS cloud persistence schema
-- Run this once in the Supabase SQL Editor.
-- The service-role key is used only by the server and never by the browser.

create table if not exists public.youtube_oauth_state (
  state text primary key,
  redirect_uri text not null,
  user_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.youtube_connection (
  id text primary key,
  user_id uuid unique,
  channel_id text not null,
  channel_title text not null,
  refresh_token text,
  access_token text,
  expires_at timestamptz,
  connected_at timestamptz not null default now()
);

create table if not exists public.jarvis_memory (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.video_logs (
  id uuid primary key default gen_random_uuid(),
  platform text,
  title text,
  status text not null default 'draft',
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.youtube_oauth_state enable row level security;
alter table public.youtube_connection enable row level security;
alter table public.jarvis_memory enable row level security;
alter table public.video_logs enable row level security;

revoke all on public.youtube_oauth_state from anon, authenticated;
revoke all on public.youtube_connection from anon, authenticated;
revoke all on public.jarvis_memory from anon, authenticated;
revoke all on public.video_logs from anon, authenticated;


-- YouTube-first hardening for existing installations.
alter table public.youtube_oauth_state add column if not exists user_id uuid;
alter table public.youtube_connection add column if not exists user_id uuid;
create unique index if not exists youtube_connection_user_id_idx on public.youtube_connection(user_id) where user_id is not null;
