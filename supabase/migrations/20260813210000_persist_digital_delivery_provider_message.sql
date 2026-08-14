alter table public.digital_delivery_notifications
  add column if not exists provider_message_id text;

create unique index if not exists digital_delivery_notifications_provider_message_key
  on public.digital_delivery_notifications(provider, provider_message_id)
  where provider_message_id is not null;

create or replace function public.complete_digital_delivery_notification(
  p_notification_id uuid,
  p_lease_token uuid,
  p_outcome text,
  p_provider text,
  p_provider_message_id text,
  p_safe_error text,
  p_max_attempts integer,
  p_retry_base_seconds integer,
  p_retry_max_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if (p_outcome = 'succeeded' and nullif(btrim(p_provider_message_id), '') is null)
     or (p_outcome = 'failed' and p_provider_message_id is not null)
  then
    raise exception 'Digital delivery provider message input is invalid';
  end if;

  v_result := public.complete_digital_delivery_notification(
    p_notification_id, p_lease_token, p_outcome, p_provider, p_safe_error,
    p_max_attempts, p_retry_base_seconds, p_retry_max_seconds
  );

  if p_outcome = 'succeeded' then
    update public.digital_delivery_notifications
    set provider_message_id = btrim(p_provider_message_id)
    where id = p_notification_id and status = 'succeeded';
  end if;
  return v_result;
end;
$$;

revoke all on function public.complete_digital_delivery_notification(uuid,uuid,text,text,text,text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.complete_digital_delivery_notification(uuid,uuid,text,text,text,text,integer,integer,integer) to service_role;
revoke execute on function public.complete_digital_delivery_notification(uuid,uuid,text,text,text,integer,integer,integer) from service_role;
