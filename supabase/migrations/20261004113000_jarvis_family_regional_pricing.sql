-- JARVIS family access + regional pricing
alter table public.jarvis_entitlements
  add column if not exists grant_source text not null default 'system'
    check (grant_source in ('system','subscription','family'));

create index if not exists jarvis_entitlements_grant_source_idx
  on public.jarvis_entitlements(grant_source);

create table if not exists public.jarvis_family_access (
  user_id uuid primary key references public.jarvis_users(id) on delete cascade,
  access_role text not null default 'family'
    check (access_role in ('owner','family')),
  active boolean not null default true,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jarvis_family_access_active_idx
  on public.jarvis_family_access(active);

alter table public.jarvis_family_access enable row level security;

create table if not exists public.jarvis_plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.jarvis_plans(id) on delete cascade,
  region_code text not null,
  currency text not null,
  unit_amount integer not null check (unit_amount >= 0),
  interval text not null default 'month' check (interval = 'month'),
  stripe_price_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id, region_code)
);

create index if not exists jarvis_plan_prices_region_idx
  on public.jarvis_plan_prices(region_code, active);

alter table public.jarvis_plan_prices enable row level security;

update public.jarvis_plans
set monthly_price_cents = case
  when code = 'pro' then 500
  when code = 'premium' then 900
  else monthly_price_cents
end,
updated_at = now()
where code in ('pro','premium');

insert into public.jarvis_plan_prices (plan_id, region_code, currency, unit_amount, stripe_price_id)
select id, 'GLOBAL', 'usd',
       case code when 'pro' then 500 when 'premium' then 900 else monthly_price_cents end,
       null
from public.jarvis_plans
where code in ('pro','premium')
on conflict (plan_id, region_code) do update
set currency = excluded.currency,
    unit_amount = excluded.unit_amount,
    updated_at = now();

insert into public.jarvis_plan_prices (plan_id, region_code, currency, unit_amount, stripe_price_id)
select id, 'NG', 'ngn',
       case code when 'pro' then 450000 when 'premium' then 800000 end,
       null
from public.jarvis_plans
where code in ('pro','premium')
on conflict (plan_id, region_code) do update
set currency = excluded.currency,
    unit_amount = excluded.unit_amount,
    updated_at = now();
