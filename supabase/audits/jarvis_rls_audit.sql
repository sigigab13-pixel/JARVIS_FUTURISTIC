-- JARVIS Supabase RLS audit (read-only)
-- Run from a trusted Supabase SQL session.
-- This does not change schema, policies, grants, or data.

-- 1) Every JARVIS table in public should have RLS enabled.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'jarvis_%'
order by c.relname;

-- 2) Show policy counts and names.
select
  c.relname as table_name,
  count(p.polname)::int as policy_count,
  array_agg(p.polname order by p.polname)
    filter (where p.polname is not null) as policies
from pg_class c
left join pg_policy p on p.polrelid = c.oid
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
  and c.relname like 'jarvis_%'
group by c.relname
order by c.relname;

-- 3) Show direct data privileges granted to browser roles.
-- REFERENCES/TRIGGER/TRUNCATE are intentionally excluded because this check
-- is looking for direct read/write exposure through the Data API.
select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'jarvis_%'
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
order by table_name, grantee, privilege_type;

-- 4) Optional: find public-schema JARVIS tables with RLS disabled.
select
  c.relname as table_name
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
  and c.relname like 'jarvis_%'
  and c.relrowsecurity = false
order by c.relname;
