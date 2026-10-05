create unique index if not exists jarvis_usage_ledger_image_idempotency_uq
  on public.jarvis_usage_ledger (
    user_id,
    operation,
    (metadata->>'idempotency_key')
  )
  where operation = 'image_generation'
    and metadata->>'idempotency_key' is not null;

create or replace function public.jarvis_consume_image_generation(
  p_user_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_entitlement public.jarvis_entitlements;
  v_idempotency_key text;
  v_existing uuid;
  v_next integer;
  v_ledger public.jarvis_usage_ledger;
begin
  if p_user_id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_USER',
      'message', 'Invalid JARVIS user id.'
    );
  end if;

  v_idempotency_key := nullif(left(coalesce(p_metadata->>'idempotency_key', ''), 200), '');

  select *
    into v_entitlement
    from public.jarvis_entitlements
   where user_id = p_user_id
   for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'ENTITLEMENT_NOT_FOUND',
      'message', 'JARVIS entitlement could not be found.'
    );
  end if;

  if v_idempotency_key is not null then
    select id
      into v_existing
      from public.jarvis_usage_ledger
     where user_id = p_user_id
       and operation = 'image_generation'
       and metadata->>'idempotency_key' = v_idempotency_key
     limit 1;

    if v_existing is not null then
      return jsonb_build_object(
        'ok', true,
        'already_charged', true,
        'credits_remaining', v_entitlement.credits_remaining
      );
    end if;
  end if;

  if coalesce(v_entitlement.credits_remaining, 0) <= 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'IMAGE_ALLOWANCE_EXHAUSTED',
      'message', 'Your image-generation allowance is used up for this billing period.',
      'credits_remaining', greatest(coalesce(v_entitlement.credits_remaining, 0), 0)
    );
  end if;

  v_next := v_entitlement.credits_remaining - 1;

  update public.jarvis_entitlements
     set credits_remaining = v_next,
         updated_at = now()
   where user_id = p_user_id;

  insert into public.jarvis_usage_ledger (
    user_id,
    operation,
    units,
    credits_charged,
    metadata
  )
  values (
    p_user_id,
    'image_generation',
    1,
    1,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning *
    into v_ledger;

  return jsonb_build_object(
    'ok', true,
    'already_charged', false,
    'credits_remaining', v_next,
    'ledger_id', v_ledger.id
  );
exception
  when unique_violation then
    select credits_remaining
      into v_next
      from public.jarvis_entitlements
     where user_id = p_user_id;

    return jsonb_build_object(
      'ok', true,
      'already_charged', true,
      'credits_remaining', coalesce(v_next, 0)
    );
end;
$function$;

revoke all on function public.jarvis_consume_image_generation(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.jarvis_consume_image_generation(uuid, jsonb) to service_role;