create table if not exists public.jarvis_media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.jarvis_users(id) on delete cascade,
  bucket_id text not null,
  object_key text not null,
  media_kind text not null default 'media',
  content_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  sha256 text,
  retention_class text not null default 'protected'
    check (retention_class in ('ephemeral','working','published','protected')),
  status text not null default 'active'
    check (status in ('reserved','active','delete_pending','deleted','failed')),
  expires_at timestamptz,
  last_referenced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(bucket_id, object_key)
);

alter table public.jarvis_media_assets enable row level security;
revoke all on public.jarvis_media_assets from anon, authenticated;

create index if not exists jarvis_media_assets_cleanup_idx
  on public.jarvis_media_assets(status, retention_class, expires_at)
  where status = 'active' and expires_at is not null;

create index if not exists jarvis_media_assets_user_idx
  on public.jarvis_media_assets(user_id, created_at desc);

insert into public.jarvis_media_assets (
  user_id,
  bucket_id,
  object_key,
  media_kind,
  content_type,
  size_bytes,
  retention_class,
  status,
  last_referenced_at,
  created_at,
  updated_at,
  metadata
)
select
  split_part(o.name, '/', 2)::uuid,
  o.bucket_id,
  o.name,
  coalesce(nullif(split_part(o.name, '/', 3), ''), 'media'),
  coalesce(o.metadata->>'mimetype', o.metadata->>'contentType'),
  coalesce(nullif(o.metadata->>'size', '')::bigint, 0),
  'protected',
  'active',
  now(),
  coalesce(o.created_at, now()),
  now(),
  jsonb_build_object('backfilled', true, 'source', 'storage.objects')
from storage.objects o
where o.bucket_id = 'jarvis-media'
  and split_part(o.name, '/', 1) = 'jarvis'
  and split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and not exists (
    select 1
    from public.jarvis_media_assets a
    where a.bucket_id = o.bucket_id
      and a.object_key = o.name
  );

grant usage on schema public to service_role;
