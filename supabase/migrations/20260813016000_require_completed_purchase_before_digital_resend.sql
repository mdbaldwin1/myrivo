alter function public.prepare_merchant_digital_delivery_resend(
  uuid, uuid, uuid, text, uuid, uuid, uuid, text, integer
) rename to prepare_merchant_digital_delivery_resend_unchecked;

revoke all on function public.prepare_merchant_digital_delivery_resend_unchecked(
  uuid, uuid, uuid, text, uuid, uuid, uuid, text, integer
) from public, anon, authenticated, service_role;

create function public.prepare_merchant_digital_delivery_resend(
  p_order_id uuid,
  p_store_id uuid,
  p_actor_user_id uuid,
  p_request_key_hash text,
  p_notification_id uuid,
  p_access_token_id uuid,
  p_token_derivation_nonce uuid,
  p_token_hash text,
  p_access_ttl_seconds integer
)
returns table(
  notification_id uuid,
  access_token_id uuid,
  status text,
  duplicate boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order
  from public.orders placed_order
  where placed_order.id = p_order_id
    and placed_order.store_id = p_store_id
  for update;

  if not found then
    raise exception 'Digital delivery order is unavailable';
  end if;

  if not exists (
    select 1
    from public.digital_delivery_jobs job
    join public.digital_delivery_notifications notification
      on notification.delivery_job_id = job.id
     and notification.order_id = job.order_id
     and notification.store_id = job.store_id
     and notification.notification_type = 'purchase'
    where job.order_id = v_order.id
      and job.store_id = v_order.store_id
      and job.job_type = 'purchase_delivery'
      and job.status = 'succeeded'
      and job.notification_sent_at is not null
      and notification.status = 'succeeded'
      and notification.sent_at is not null
  ) then
    raise exception 'Digital delivery resend is ineligible';
  end if;

  return query
  select prepared.notification_id, prepared.access_token_id,
         prepared.status, prepared.duplicate
  from public.prepare_merchant_digital_delivery_resend_unchecked(
    p_order_id,
    p_store_id,
    p_actor_user_id,
    p_request_key_hash,
    p_notification_id,
    p_access_token_id,
    p_token_derivation_nonce,
    p_token_hash,
    p_access_ttl_seconds
  ) prepared;
end;
$$;

revoke all on function public.prepare_merchant_digital_delivery_resend(
  uuid, uuid, uuid, text, uuid, uuid, uuid, text, integer
) from public, anon, authenticated;

grant execute on function public.prepare_merchant_digital_delivery_resend(
  uuid, uuid, uuid, text, uuid, uuid, uuid, text, integer
) to service_role;
