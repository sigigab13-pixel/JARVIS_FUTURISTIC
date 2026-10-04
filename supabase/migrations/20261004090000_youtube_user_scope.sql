-- User-scoped YouTube OAuth persistence.
-- Apply after the initial YouTube connection tables exist.

alter table public.youtube_oauth_state
  add column if not exists user_id uuid;

alter table public.youtube_connection
  add column if not exists user_id uuid;

create unique index if not exists youtube_connection_user_id_idx
  on public.youtube_connection(user_id)
  where user_id is not null;
