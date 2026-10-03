alter table public.jarvis_routines
  add column if not exists lease_until timestamptz,
  add column if not exists leased_by text;

create index if not exists jarvis_routines_lease_idx
  on public.jarvis_routines(lease_until);

create or replace function public.jarvis_claim_due_routines(p_worker_id text, p_limit integer default 10)
returns setof public.jarvis_routines
language sql
as $$
  with due as (
    select id
    from public.jarvis_routines
    where status = 'active'
      and next_run_at <= now()
      and (lease_until is null or lease_until < now())
    order by priority desc, next_run_at asc
    limit greatest(1, least(coalesce(p_limit, 10), 50))
    for update skip locked
  )
  update public.jarvis_routines r
  set lease_until = now() + interval '2 minutes',
      leased_by = p_worker_id,
      updated_at = now()
  from due
  where r.id = due.id
  returning r.*;
$$;

revoke execute on function public.jarvis_claim_due_routines(text, integer) from public;
revoke execute on function public.jarvis_claim_due_routines(text, integer) from anon;
revoke execute on function public.jarvis_claim_due_routines(text, integer) from authenticated;
grant execute on function public.jarvis_claim_due_routines(text, integer) to service_role;
