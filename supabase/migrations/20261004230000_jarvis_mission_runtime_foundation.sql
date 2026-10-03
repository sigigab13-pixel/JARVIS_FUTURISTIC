create table if not exists public.jarvis_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.jarvis_users(id) on delete cascade,
  goal text not null,
  autonomy text not null default 'advise' check (autonomy in ('advise','prepare','execute_with_approval','execute_within_policy')),
  status text not null default 'draft' check (status in ('draft','queued','running','waiting_approval','paused','blocked','succeeded','failed','canceled')),
  current_step integer not null default 0 check (current_step >= -1),
  steps jsonb not null default '[]'::jsonb,
  approval jsonb not null default '{}'::jsonb,
  last_evidence jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.jarvis_mission_events (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.jarvis_missions(id) on delete cascade,
  user_id uuid not null references public.jarvis_users(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists jarvis_missions_user_updated_idx on public.jarvis_missions(user_id, updated_at desc);
create index if not exists jarvis_mission_events_mission_created_idx on public.jarvis_mission_events(mission_id, created_at desc);

alter table public.jarvis_missions enable row level security;
alter table public.jarvis_mission_events enable row level security;

drop policy if exists "jarvis_missions_owner_select" on public.jarvis_missions;
create policy "jarvis_missions_owner_select" on public.jarvis_missions for select to authenticated
  using (exists (select 1 from public.jarvis_users ju where ju.id = jarvis_missions.user_id and ju.auth_user_id = (select auth.uid())));

drop policy if exists "jarvis_missions_owner_insert" on public.jarvis_missions;
create policy "jarvis_missions_owner_insert" on public.jarvis_missions for insert to authenticated
  with check (exists (select 1 from public.jarvis_users ju where ju.id = jarvis_missions.user_id and ju.auth_user_id = (select auth.uid())));

drop policy if exists "jarvis_missions_owner_update" on public.jarvis_missions;
create policy "jarvis_missions_owner_update" on public.jarvis_missions for update to authenticated
  using (exists (select 1 from public.jarvis_users ju where ju.id = jarvis_missions.user_id and ju.auth_user_id = (select auth.uid())))
  with check (exists (select 1 from public.jarvis_users ju where ju.id = jarvis_missions.user_id and ju.auth_user_id = (select auth.uid())));

drop policy if exists "jarvis_missions_owner_delete" on public.jarvis_missions;
create policy "jarvis_missions_owner_delete" on public.jarvis_missions for delete to authenticated
  using (exists (select 1 from public.jarvis_users ju where ju.id = jarvis_missions.user_id and ju.auth_user_id = (select auth.uid())));

drop policy if exists "jarvis_mission_events_owner_select" on public.jarvis_mission_events;
create policy "jarvis_mission_events_owner_select" on public.jarvis_mission_events for select to authenticated
  using (exists (select 1 from public.jarvis_users ju where ju.id = jarvis_mission_events.user_id and ju.auth_user_id = (select auth.uid())));

drop policy if exists "jarvis_mission_events_owner_insert" on public.jarvis_mission_events;
create policy "jarvis_mission_events_owner_insert" on public.jarvis_mission_events for insert to authenticated
  with check (exists (select 1 from public.jarvis_users ju where ju.id = jarvis_mission_events.user_id and ju.auth_user_id = (select auth.uid())));
