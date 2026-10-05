-- JARVIS RLS hardening draft — LAB ONLY
-- This file is intentionally not applied to the production Supabase project.
-- Review and verify in a Supabase development/branch database first.

begin;

-- Public pricing is read-only data.
alter table public.jarvis_plan_prices enable row level security;

drop policy if exists "public can read active plan prices" on public.jarvis_plan_prices;
create policy "public can read active plan prices"
on public.jarvis_plan_prices
for select
to anon, authenticated
using (active = true);

-- The Data API also needs table-level SELECT privilege.
grant select on public.jarvis_plan_prices to anon, authenticated;

-- Family access is sensitive. The current schema has only user_id, so the
-- safe enforceable rule is: an authenticated user may read their own row.
-- No browser-role INSERT/UPDATE/DELETE grants are added.
alter table public.jarvis_family_access enable row level security;

drop policy if exists "users can read own family access" on public.jarvis_family_access;
create policy "users can read own family access"
on public.jarvis_family_access
for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.jarvis_family_access to authenticated;

commit;

-- Verification (run separately in a trusted read-only SQL session):
--
-- select
--   c.relname as table_name,
--   c.relrowsecurity as rls_enabled,
--   count(p.polname)::int as policy_count,
--   array_agg(p.polname order by p.polname)
--     filter (where p.polname is not null) as policies
-- from pg_class c
-- left join pg_policy p on p.polrelid = c.oid
-- where c.relnamespace = 'public'::regnamespace
--   and c.relkind = 'r'
--   and c.relname in ('jarvis_plan_prices', 'jarvis_family_access')
-- group by c.relname, c.relrowsecurity
-- order by c.relname;
--
-- Expected:
-- jarvis_family_access -> RLS true, 1 policy: users can read own family access
-- jarvis_plan_prices   -> RLS true, 1 policy: public can read active plan prices
