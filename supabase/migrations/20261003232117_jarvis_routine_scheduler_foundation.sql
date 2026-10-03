create table if not exists public.jarvis_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.jarvis_users(id) on delete cascade,
  name text not null,
  description text,
  schedule text not null,
  timezone text not null default 'Africa/Lagos',
  status text not null default 'active' check (status in ('active','paused','disabled')),
  priority integer not null default 50 check (priority between 0 and 100),
  max_parallel_jobs integer not null default 4 check (max_parallel_jobs between 1 and 8),
  job_templates jsonb not null default '[]'::jsonb,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  last_run_status text,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jarvis_routine_runs (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.jarvis_routines(id) on delete cascade,
  user_id uuid not null references public.jarvis_users(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','partial','failed')),
  child_job_ids jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (routine_id, scheduled_for)
);

create index if not exists jarvis_routines_due_idx
  on public.jarvis_routines(status, next_run_at, priority);

create index if not exists jarvis_routines_user_idx
  on public.jarvis_routines(user_id, updated_at desc);

create index if not exists jarvis_routine_runs_user_idx
  on public.jarvis_routine_runs(user_id, created_at desc);

alter table public.jarvis_routines enable row level security;
alter table public.jarvis_routine_runs enable row level security;

drop policy if exists "jarvis_routines_owner_select" on public.jarvis_routines;
create policy "jarvis_routines_owner_select" on public.jarvis_routines
  for select to authenticated
  using (exists (select 1 from public.jarvis_users ju where ju.id = jarvis_routines.user_id and ju.auth_user_id = (select auth.uid())));

drop policy if exists "jarvis_routines_owner_insert" on public.jarvis_routines;
create policy "jarvis_routines_owner_insert" on public.jarvis_routines
  for insert to authenticated
  with check (exists (select 1 from public.jarvis_users ju where ju.id = jarvis_routines.user_id and ju.auth_user_id = (select auth.uid())));

drop policy if exists "jarvis_routines_owner_update" on public.jarvis_routines;
create policy "jarvis_routines_owner_update" on public.jarvis_routines
  for update to authenticated
  using (exists (select 1 from public.jarvis_users ju where ju.id = jarvis_routines.user_id and ju.auth_user_id = (select auth.uid())))
  with check (exists (select 1 from public.jarvis_users ju where ju.id = jarvis_routines.user_id and ju.auth_user_id = (select auth.uid())));

drop policy if exists "jarvis_routines_owner_delete" on public.jarvis_routines;
create policy "jarvis_routines_owner_delete" on public.jarvis_routines
  for delete to authenticated
  using (exists (select 1 from public.jarvis_users ju where ju.id = jarvis_routines.user_id and ju.auth_user_id = (select auth.uid())));

drop policy if exists "jarvis_routine_runs_owner_select" on public.jarvis_routine_runs;
create policy "jarvis_routine_runs_owner_select" on public.jarvis_routine_runs
  for select to authenticated
  using (exists (select 1 from public.jarvis_users ju where ju.id = jarvis_routine_runs.user_id and ju.auth_user_id = (select auth.uid())));

drop policy if exists "jarvis_routine_runs_owner_insert" on public.jarvis_routine_runs;
create policy "jarvis_routine_runs_owner_insert" on public.jarvis_routine_runs
  for insert to authenticated
  with check (exists (select 1 from public.jarvis_users ju where ju.id = jarvis_routine_runs.user_id and ju.auth_user_id = (select auth.uid())));

drop policy if exists "jarvis_routine_runs_owner_update" on public.jarvis_routine_runs;
create policy "jarvis_routine_runs_owner_update" on public.jarvis_routine_runs
  for update to authenticated
  using (exists (select 1 from public.jarvis_users ju where ju.id = jarvis_routine_runs.user_id and ju.auth_user_id = (select auth.uid())))
  with check (exists (select 1 from public.jarvis_users ju where ju.id = jarvis_routine_runs.user_id and ju.auth_user_id = (select auth.uid())));
