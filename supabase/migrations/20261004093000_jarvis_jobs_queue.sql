-- JARVIS durable worker queue.
-- Provides the jobs table plus atomic claim/lease/finish/fail RPCs used by server/worker.mjs.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.jarvis_users(id) on delete cascade,
  parent_job_id uuid references public.jobs(id) on delete set null,
  type text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','canceled')),
  priority integer not null default 50 check (priority between 0 and 100),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error jsonb not null default '{}'::jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 8),
  idempotency_key text,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  lease_until timestamptz,
  leased_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists jobs_user_idempotency_idx
  on public.jobs(user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists jobs_queue_claim_idx
  on public.jobs(status, scheduled_at, priority desc, created_at asc);

create index if not exists jobs_user_updated_idx
  on public.jobs(user_id, updated_at desc);

alter table public.jobs enable row level security;

drop policy if exists "jobs_owner_select" on public.jobs;
create policy "jobs_owner_select" on public.jobs
  for select to authenticated
  using (exists (
    select 1 from public.jarvis_users ju
    where ju.id = jobs.user_id and ju.auth_user_id = (select auth.uid())
  ));

drop policy if exists "jobs_owner_insert" on public.jobs;
create policy "jobs_owner_insert" on public.jobs
  for insert to authenticated
  with check (exists (
    select 1 from public.jarvis_users ju
    where ju.id = jobs.user_id and ju.auth_user_id = (select auth.uid())
  ));

drop policy if exists "jobs_owner_update" on public.jobs;
create policy "jobs_owner_update" on public.jobs
  for update to authenticated
  using (exists (
    select 1 from public.jarvis_users ju
    where ju.id = jobs.user_id and ju.auth_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.jarvis_users ju
    where ju.id = jobs.user_id and ju.auth_user_id = (select auth.uid())
  ));

create or replace function public.worker_claim_next_job(p_worker_id text)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.jobs;
begin
  update public.jobs j
  set status = 'queued',
      lease_until = null,
      leased_by = null,
      updated_at = now()
  where j.status = 'running'
    and j.lease_until is not null
    and j.lease_until < now();

  with candidate as (
    select id
    from public.jobs
    where status = 'queued'
      and scheduled_at <= now()
    order by priority desc, scheduled_at asc, created_at asc
    for update skip locked
    limit 1
  )
  update public.jobs j
  set status = 'running',
      attempts = j.attempts + 1,
      started_at = coalesce(j.started_at, now()),
      lease_until = now() + interval '2 minutes',
      leased_by = p_worker_id,
      updated_at = now()
  from candidate c
  where j.id = c.id
  returning j.*;

  return query
  select * from public.jobs
  where leased_by = p_worker_id
    and status = 'running'
  order by updated_at desc
  limit 1;
end;
$$;

create or replace function public.worker_claim_job(p_job_id uuid, p_worker_id text)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.jobs
  set status = 'queued',
      lease_until = null,
      leased_by = null,
      updated_at = now()
  where id = p_job_id
    and status = 'running'
    and lease_until is not null
    and lease_until < now();

  return query
  update public.jobs
  set status = 'running',
      attempts = attempts + 1,
      started_at = coalesce(started_at, now()),
      lease_until = now() + interval '2 minutes',
      leased_by = p_worker_id,
      updated_at = now()
  where id = p_job_id
    and status = 'queued'
    and scheduled_at <= now()
  returning *;
end;
$$;

create or replace function public.worker_heartbeat_job(p_job_id uuid, p_worker_id text)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.jobs;
begin
  update public.jobs
  set lease_until = now() + interval '2 minutes',
      updated_at = now()
  where id = p_job_id
    and status = 'running'
    and leased_by = p_worker_id
  returning * into row;
  return row;
end;
$$;

create or replace function public.worker_finish_job(p_job_id uuid, p_worker_id text, p_result jsonb)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.jobs;
begin
  update public.jobs
  set status = 'succeeded',
      result = coalesce(p_result, '{}'::jsonb),
      error = '{}'::jsonb,
      finished_at = now(),
      lease_until = null,
      leased_by = null,
      updated_at = now()
  where id = p_job_id
    and status = 'running'
    and leased_by = p_worker_id
  returning * into row;
  return row;
end;
$$;

create or replace function public.worker_fail_job(p_job_id uuid, p_worker_id text, p_error jsonb)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.jobs;
begin
  update public.jobs
  set status = case
        when attempts < max_attempts then 'queued'
        else 'failed'
      end,
      error = coalesce(p_error, '{}'::jsonb),
      scheduled_at = case
        when attempts < max_attempts
          then now() + make_interval(secs => least(300, greatest(5, attempts * attempts * 5)))
        else scheduled_at
      end,
      finished_at = case when attempts < max_attempts then null else now() end,
      lease_until = null,
      leased_by = null,
      updated_at = now()
  where id = p_job_id
    and status = 'running'
    and leased_by = p_worker_id
  returning * into row;
  return row;
end;
$$;

revoke all on function public.worker_claim_next_job(text) from public, anon, authenticated;
revoke all on function public.worker_claim_job(uuid, text) from public, anon, authenticated;
revoke all on function public.worker_heartbeat_job(uuid, text) from public, anon, authenticated;
revoke all on function public.worker_finish_job(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.worker_fail_job(uuid, text, jsonb) from public, anon, authenticated;

grant execute on function public.worker_claim_next_job(text) to service_role;
grant execute on function public.worker_claim_job(uuid, text) to service_role;
grant execute on function public.worker_heartbeat_job(uuid, text) to service_role;
grant execute on function public.worker_finish_job(uuid, text, jsonb) to service_role;
grant execute on function public.worker_fail_job(uuid, text, jsonb) to service_role;
