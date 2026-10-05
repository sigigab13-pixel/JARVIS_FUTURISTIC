-- JARVIS RLS hardening draft — LAB ONLY
-- This migration is intentionally NOT applied to production.
-- Live schema verified on 2026-10-05 before finalizing these predicates.
--
-- Verified columns:
--   jarvis_plan_prices: id, plan_id, region_code, currency, unit_amount,
--     interval, stripe_price_id, active, created_at, updated_at
--   jarvis_family_access: user_id, access_role, active, granted_at, updated_at
--   public.jarvis_families: does not exist
--
-- Access model for this draft:
--   plan prices: public read of active rows only
--   family access: authenticated users read only their own row
--   browser roles: no table privileges for writes or other direct table actions
--   server/service-role access remains server-side and is outside these grants

begin;

-- ---------------------------------------------------------------------------
-- 1) Regional plan prices: public catalog, read-only
-- ---------------------------------------------------------------------------

alter table public.jarvis_plan_prices enable row level security;

drop policy if exists "public can read active plan prices"
  on public.jarvis_plan_prices;

create policy "public can read active plan prices"
on public.jarvis_plan_prices
for select
to anon, authenticated
using (active = true);

-- Reset browser-role table privileges so this table cannot be written or
-- modified through direct Data API table access.
revoke all privileges
  on table public.jarvis_plan_prices
  from anon, authenticated;

grant select
  on table public.jarvis_plan_prices
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Family access: own-row read only
-- ---------------------------------------------------------------------------

alter table public.jarvis_family_access enable row level security;

drop policy if exists "users can read own family access"
  on public.jarvis_family_access;

create policy "users can read own family access"
on public.jarvis_family_access
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Reset browser-role table privileges and expose only authenticated SELECT.
revoke all privileges
  on table public.jarvis_family_access
  from anon, authenticated;

grant select
  on table public.jarvis_family_access
  to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Verification (trusted read-only SQL session; NOT part of the migration)
-- ---------------------------------------------------------------------------
--
-- A) Policy + RLS state
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
--   jarvis_family_access -> RLS true, 1 policy
--   jarvis_plan_prices   -> RLS true, 1 policy
--
-- B) Browser-role grants
--
-- select table_name, grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name in ('jarvis_family_access', 'jarvis_plan_prices')
--   and grantee in ('anon', 'authenticated')
-- order by table_name, grantee, privilege_type;
--
-- Expected:
--   jarvis_plan_prices   -> anon SELECT, authenticated SELECT
--   jarvis_family_access -> authenticated SELECT
--
-- C) Authenticated self-read behavior should be tested in a Supabase branch /
-- development database using two real users. Do not spoof auth.uid() in
-- production SQL. The required invariant is:
--   User A can SELECT A's family-access row.
--   User A cannot SELECT User B's family-access row.
