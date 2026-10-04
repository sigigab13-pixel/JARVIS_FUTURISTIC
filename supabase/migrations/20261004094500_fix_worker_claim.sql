-- Repair the worker claim RPC so its UPDATE RETURNING is captured safely
-- and the claimed row is returned deterministically to the caller.

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
  returning j.* into claimed;

  if claimed.id is not null then
    return next claimed;
  end if;

  return;
end;
$$;

revoke all on function public.worker_claim_next_job(text) from public, anon, authenticated;
grant execute on function public.worker_claim_next_job(text) to service_role;
