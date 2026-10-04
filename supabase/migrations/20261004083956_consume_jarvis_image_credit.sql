create or replace function public.consume_jarvis_image_credit(
  p_user_id uuid,
  p_operation text default 'image_generation',
  p_units integer default 1,
  p_credits_charged integer default 1,
  p_metadata jsonb default '{}'::jsonb
)
returns table(user_id uuid, credits_remaining integer)
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if p_units <= 0 or p_credits_charged <= 0 then
    raise exception using
      message = 'Invalid image credit charge.',
      errcode = '22023';
  end if;

  update public.jarvis_entitlements
     set credits_remaining = credits_remaining - p_credits_charged,
         updated_at = now()
   where user_id = p_user_id
     and credits_remaining >= p_credits_charged
   returning public.jarvis_entitlements.credits_remaining
    into credits_remaining;

  if not found then
    raise exception using
      message = 'IMAGE_ALLOWANCE_EXHAUSTED',
      errcode = 'P0001';
  end if;

  insert into public.jarvis_usage_ledger (
    user_id,
    operation,
    units,
    credits_charged,
    metadata
  )
  values (
    p_user_id,
    p_operation,
    p_units,
    p_credits_charged,
    coalesce(p_metadata, '{}'::jsonb)
  );

  user_id := p_user_id;
  return next;
end;
$function$;

revoke execute on function public.consume_jarvis_image_credit(uuid, text, integer, integer, jsonb)
  from public, anon, authenticated;

grant execute on function public.consume_jarvis_image_credit(uuid, text, integer, integer, jsonb)
  to service_role;

alter function public.jarvis_claim_due_routines(text, integer)
  set search_path = '';
