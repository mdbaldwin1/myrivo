-- Give eligible and ineligible recovery requests a shared transactional
-- lock/write shape before ownership lookup. Rows are fixed buckets: they never
-- persist request hashes, customer identifiers, or bearer material.

create table public.digital_access_recovery_decoys (
  bucket text primary key check (bucket ~ '^[a-f0-9]$'),
  touch_count bigint not null default 0 check (touch_count >= 0)
);

insert into public.digital_access_recovery_decoys(bucket)
select to_hex(value) from generate_series(0, 15) value
on conflict (bucket) do nothing;

alter table public.digital_access_recovery_decoys enable row level security;
revoke all on table public.digital_access_recovery_decoys
from public, anon, authenticated, service_role;

create or replace function public.prepare_customer_digital_access_recovery(
  p_order_id uuid,
  p_customer_email text,
  p_request_pair_hash text,
  p_notification_id uuid,
  p_access_token_id uuid,
  p_token_derivation_nonce uuid,
  p_token_hash text,
  p_access_ttl_seconds integer
)
returns table(queued boolean, notification_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_now timestamptz := clock_timestamp();
  v_configured_ttl integer;
begin
  if p_request_pair_hash !~ '^[a-f0-9]{64}$'
     or p_token_hash !~ '^[a-f0-9]{64}$'
     or nullif(lower(trim(p_customer_email)), '') is null
     or char_length(trim(p_customer_email)) > 254
     or p_notification_id is null
     or p_access_token_id is null
     or p_token_derivation_nonce is null
  then
    return query select false, null::uuid;
    return;
  end if;

  select policy.access_link_ttl_seconds into v_configured_ttl
  from public.digital_checkout_policy_versions policy
  where policy.singleton = true;
  if not found or p_access_ttl_seconds is distinct from v_configured_ttl then
    return query select false, null::uuid;
    return;
  end if;

  update public.digital_access_recovery_decoys decoy
  set touch_count = decoy.touch_count + 1
  where decoy.bucket = left(p_request_pair_hash, 1);
  if not found then
    raise exception 'Digital recovery decoy state is unavailable';
  end if;

  select * into v_order
  from public.orders placed_order
  where placed_order.id = p_order_id
    and lower(trim(placed_order.customer_email)) = lower(trim(p_customer_email))
  for update;

  if not found
     or not public.is_digital_download_order_eligible(v_order.id, v_order.store_id)
     or not exists (
       select 1 from public.digital_order_entitlements entitlement
       where entitlement.order_id = v_order.id
         and entitlement.store_id = v_order.store_id
     )
     or exists (
       select 1 from public.digital_order_entitlements entitlement
       where entitlement.order_id = v_order.id
         and entitlement.store_id = v_order.store_id
         and entitlement.status <> 'active'
     )
  then
    return query select false, null::uuid;
    return;
  end if;

  update public.digital_order_access_tokens token
  set revoked_at = v_now
  where token.order_id = v_order.id
    and token.store_id = v_order.store_id
    and token.issuance_reason = 'customer_request'
    and token.revoked_at is null;

  insert into public.digital_order_access_tokens(
    id, store_id, order_id, delivery_job_id, token_derivation_nonce,
    token_hash, issuance_reason, expires_at, created_at, requested_by_user_id
  ) values (
    p_access_token_id, v_order.store_id, v_order.id, null,
    p_token_derivation_nonce, p_token_hash, 'customer_request',
    v_now + make_interval(secs => p_access_ttl_seconds), v_now, null
  );

  insert into public.digital_delivery_notifications(
    id, store_id, order_id, delivery_job_id, access_token_id,
    notification_type, request_key_hash, requested_by_user_id,
    status, next_attempt_at, created_at, updated_at
  ) values (
    p_notification_id, v_order.store_id, v_order.id, null,
    p_access_token_id, 'customer_recovery', p_request_pair_hash, null,
    'pending', v_now, v_now, v_now
  );

  insert into public.audit_events(
    store_id, actor_user_id, action, entity, entity_id, metadata
  ) values (
    v_order.store_id, null, 'digital_order_access_recovery_queued',
    'order', v_order.id::text,
    jsonb_build_object(
      'notificationId', p_notification_id,
      'notificationType', 'customer_recovery',
      'accessTtlHours', p_access_ttl_seconds / 3600
    )
  );

  return query select true, p_notification_id;
exception when others then
  if p_request_pair_hash ~ '^[a-f0-9]{64}$' then
    insert into public.digital_access_recovery_failures(
      request_pair_hash, safe_error
    ) values (p_request_pair_hash, 'Digital access recovery failed');
  end if;
  return query select false, null::uuid;
end;
$$;

revoke all on function public.prepare_customer_digital_access_recovery(
  uuid, text, text, uuid, uuid, uuid, text, integer
) from public, anon, authenticated;
grant execute on function public.prepare_customer_digital_access_recovery(
  uuid, text, text, uuid, uuid, uuid, text, integer
) to service_role;
