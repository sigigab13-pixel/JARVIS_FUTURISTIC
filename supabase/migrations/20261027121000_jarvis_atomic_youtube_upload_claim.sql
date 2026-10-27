-- Atomically claim a mission's first YouTube upload attempt.
-- The row-level UPDATE lock ensures only one concurrent request can change
-- a mission from "no attempt" to "in_progress".
create or replace function public.jarvis_claim_youtube_upload_attempt(
  p_user_id uuid,
  p_mission_id uuid,
  p_attempt jsonb
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_user_id is null or p_mission_id is null
     or p_attempt is null
     or jsonb_typeof(p_attempt) <> 'object'
     or p_attempt->>'id' is null
     or p_attempt->>'status' <> 'in_progress' then
    return false;
  end if;

  update public.jarvis_missions
     set metadata = jsonb_set(
           coalesce(metadata, '{}'::jsonb),
           '{youtubeUploadAttempt}',
           p_attempt,
           true
         ),
         updated_at = now()
   where id = p_mission_id
     and user_id = p_user_id
     and coalesce(metadata->'youtubeUploadAttempt', 'null'::jsonb) = 'null'::jsonb
     and metadata->'youtube'->>'videoId' is null;

  return found;
end;
$function$;

revoke all on function public.jarvis_claim_youtube_upload_attempt(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.jarvis_claim_youtube_upload_attempt(uuid, uuid, jsonb)
  to service_role;
