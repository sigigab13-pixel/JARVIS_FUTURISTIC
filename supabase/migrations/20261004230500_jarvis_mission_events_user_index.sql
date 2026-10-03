create index if not exists jarvis_mission_events_user_idx
  on public.jarvis_mission_events(user_id, created_at desc);