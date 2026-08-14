-- Complete guest recovery and authenticated customer access without exposing
-- bearer values or customer identifiers in durable operational state.

alter table public.digital_checkout_policy_versions
  add column if not exists authenticated_access_ttl_seconds integer
    not null default 900
    check (authenticated_access_ttl_seconds between 300 and 3600);

alter table public.digital_order_access_tokens
  add column if not exists requested_by_user_id uuid
    references auth.users(id) on delete set null;

-- Prototype customer-request tokens were random values that cannot be
-- reconstructed by the durable worker. They may continue to exist for audit,
-- but must not remain active after the queue-backed recovery path is installed.
update public.digital_order_access_tokens
set revoked_at = greatest(created_at, clock_timestamp())
where issuance_reason = 'customer_request'
  and token_derivation_nonce is null
  and revoked_at is null;

alter table public.digital_order_access_tokens
  drop constraint if exists digital_order_access_tokens_issuance_reason_check,
  add constraint digital_order_access_tokens_issuance_reason_check
    check (issuance_reason in (
      'purchase', 'customer_request', 'merchant_resend', 'customer_session'
    )),
  drop constraint if exists digital_order_access_tokens_delivery_derivation_pair_check,
  add constraint digital_order_access_tokens_delivery_derivation_pair_check
    check (
      (
        issuance_reason = 'purchase'
        and requested_by_user_id is null
        and (
          (delivery_job_id is null and token_derivation_nonce is null)
          or (delivery_job_id is not null and token_derivation_nonce is not null)
        )
      )
      or (
        issuance_reason = 'customer_request'
        and requested_by_user_id is null
        and delivery_job_id is null
        and (token_derivation_nonce is not null or revoked_at is not null)
      )
      or (
        issuance_reason = 'merchant_resend'
        and requested_by_user_id is null
        and delivery_job_id is null
        and token_derivation_nonce is not null
      )
      or (
        issuance_reason = 'customer_session'
        and requested_by_user_id is not null
        and delivery_job_id is null
        and token_derivation_nonce is null
      )
    );

with ranked_recovery as (
  select token.id,
         row_number() over (
           partition by token.order_id
           order by token.created_at desc, token.id desc
         ) active_rank
  from public.digital_order_access_tokens token
  where token.issuance_reason = 'customer_request'
    and token.revoked_at is null
)
update public.digital_order_access_tokens token
set revoked_at = clock_timestamp()
from ranked_recovery ranked
where token.id = ranked.id and ranked.active_rank > 1;

create unique index if not exists digital_order_access_tokens_active_customer_request_key
  on public.digital_order_access_tokens(order_id)
  where issuance_reason = 'customer_request' and revoked_at is null;

create unique index if not exists digital_order_access_tokens_active_customer_session_key
  on public.digital_order_access_tokens(order_id, requested_by_user_id)
  where issuance_reason = 'customer_session' and revoked_at is null;

alter table public.digital_delivery_notifications
  drop constraint if exists digital_delivery_notifications_notification_type_check,
  add constraint digital_delivery_notifications_notification_type_check
    check (notification_type in (
      'purchase', 'merchant_resend', 'customer_recovery'
    )),
  drop constraint if exists digital_delivery_notifications_kind_check,
  add constraint digital_delivery_notifications_kind_check
    check (
      (
        notification_type = 'purchase'
        and delivery_job_id is not null
        and request_key_hash is null
        and requested_by_user_id is null
      )
      or (
        notification_type = 'merchant_resend'
        and delivery_job_id is null
        and request_key_hash is not null
        and requested_by_user_id is not null
      )
      or (
        notification_type = 'customer_recovery'
        and delivery_job_id is null
        and request_key_hash is not null
        and requested_by_user_id is null
      )
    );

create table public.digital_access_recovery_failures (
  id uuid primary key default gen_random_uuid(),
  request_pair_hash text not null check (request_pair_hash ~ '^[a-f0-9]{64}$'),
  safe_error text not null
    check (char_length(trim(safe_error)) between 1 and 200),
  created_at timestamptz not null default clock_timestamp()
);

create index digital_access_recovery_failures_created_idx
  on public.digital_access_recovery_failures(created_at desc);

alter table public.digital_access_recovery_failures enable row level security;

create or replace function public.record_customer_digital_access_recovery_failure(
  p_request_pair_hash text,
  p_safe_error text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_safe_error text;
begin
  if p_request_pair_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Digital access recovery failure input is invalid';
  end if;
  v_safe_error := nullif(left(trim(coalesce(p_safe_error, '')), 200), '');
  if v_safe_error is null
     or v_safe_error ~* '(authorization|bearer|api[_ -]?key|secret|https?://|@|(?:private|digital-product-assets)/)'
  then
    v_safe_error := 'Digital access recovery failed';
  end if;
  insert into public.digital_access_recovery_failures(
    request_pair_hash, safe_error
  ) values (p_request_pair_hash, v_safe_error);
  return 'recorded';
end;
$$;

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

create or replace function public.issue_authenticated_customer_digital_access(
  p_order_id uuid,
  p_actor_user_id uuid,
  p_customer_email text,
  p_access_token_id uuid,
  p_token_hash text,
  p_access_ttl_seconds integer
)
returns table(
  available boolean,
  access_token_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_now timestamptz := clock_timestamp();
  v_configured_ttl integer;
  v_expires_at timestamptz;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$'
     or p_access_token_id is null
     or p_actor_user_id is null
     or nullif(lower(trim(p_customer_email)), '') is null
     or char_length(trim(p_customer_email)) > 254
  then
    return query select false, null::uuid, null::timestamptz;
    return;
  end if;
  select policy.authenticated_access_ttl_seconds into v_configured_ttl
  from public.digital_checkout_policy_versions policy
  where policy.singleton = true;
  if not found or p_access_ttl_seconds is distinct from v_configured_ttl then
    return query select false, null::uuid, null::timestamptz;
    return;
  end if;
  if not exists (
    select 1 from auth.users account
    where account.id = p_actor_user_id
      and lower(trim(account.email)) = lower(trim(p_customer_email))
  ) then
    return query select false, null::uuid, null::timestamptz;
    return;
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
         and entitlement.status = 'active'
     )
     or exists (
       select 1 from public.digital_order_entitlements entitlement
       where entitlement.order_id = v_order.id
         and entitlement.store_id = v_order.store_id
         and entitlement.status <> 'active'
     )
  then
    return query select false, null::uuid, null::timestamptz;
    return;
  end if;

  update public.digital_order_access_tokens token
  set revoked_at = v_now
  where token.order_id = v_order.id
    and token.store_id = v_order.store_id
    and token.issuance_reason = 'customer_session'
    and token.requested_by_user_id = p_actor_user_id
    and token.revoked_at is null;

  v_expires_at := v_now + make_interval(secs => p_access_ttl_seconds);
  insert into public.digital_order_access_tokens(
    id, store_id, order_id, delivery_job_id, token_derivation_nonce,
    token_hash, issuance_reason, expires_at, created_at, requested_by_user_id
  ) values (
    p_access_token_id, v_order.store_id, v_order.id, null, null,
    p_token_hash, 'customer_session', v_expires_at, v_now, p_actor_user_id
  );

  insert into public.audit_events(
    store_id, actor_user_id, action, entity, entity_id, metadata
  ) values (
    v_order.store_id, p_actor_user_id, 'digital_order_authenticated_access_issued',
    'order', v_order.id::text,
    jsonb_build_object(
      'accessTokenId', p_access_token_id,
      'accessTtlMinutes', p_access_ttl_seconds / 60
    )
  );
  return query select true, p_access_token_id, v_expires_at;
end;
$$;

drop function if exists public.authorize_digital_download_access(text);
create function public.authorize_digital_download_access(p_token_hash text)
returns table(
  access_token_id uuid,
  order_id uuid,
  store_id uuid,
  expires_at timestamptz,
  store_name text,
  store_slug text,
  license_version text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select token.id, token.order_id, token.store_id, token.expires_at,
         store.name, store.slug,
         (
           select min(entitlement.license_version)
           from public.digital_order_entitlements entitlement
           where entitlement.order_id = token.order_id
             and entitlement.store_id = token.store_id
         )
  from public.digital_order_access_tokens token
  join public.stores store on store.id = token.store_id
  where p_token_hash ~ '^[a-f0-9]{64}$'
    and token.token_hash = p_token_hash
    and token.revoked_at is null
    and token.expires_at > clock_timestamp()
    and public.is_digital_download_order_eligible(token.order_id, token.store_id)
  limit 1
$$;

drop function if exists public.list_authorized_digital_downloads(uuid);
create function public.list_authorized_digital_downloads(p_access_token_id uuid)
returns table(
  entitlement_id uuid,
  label text,
  customer_filename text,
  mime_type text,
  byte_size bigint,
  status text,
  grants_remaining integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_access public.digital_order_access_tokens%rowtype;
begin
  select * into v_access
  from public.digital_order_access_tokens token
  where token.id = p_access_token_id
    and token.revoked_at is null
    and token.expires_at > clock_timestamp();
  if not found
     or not public.is_digital_download_order_eligible(
       v_access.order_id, v_access.store_id
     )
  then
    return;
  end if;

  return query
  select entitlement.id,
         coalesce(manifest_label.label, entitlement.customer_filename),
         entitlement.customer_filename,
         entitlement.mime_type,
         entitlement.byte_size,
         entitlement.status,
         greatest(
           entitlement.max_download_grants - entitlement.download_grants_used,
           0
         )
  from public.digital_order_entitlements entitlement
  left join lateral (
    select item.label
    from public.digital_purchase_manifest_items item
    where item.order_id = entitlement.order_id
      and item.order_item_id = entitlement.order_item_id
      and item.asset_version_id = entitlement.asset_version_id
      and item.store_id = entitlement.store_id
    order by item.sort_order, item.id
    limit 1
  ) manifest_label on true
  where entitlement.order_id = v_access.order_id
    and entitlement.store_id = v_access.store_id
  order by entitlement.created_at, entitlement.id;
end;
$$;

revoke all on function public.record_customer_digital_access_recovery_failure(text, text)
from public, anon, authenticated;
revoke all on function public.prepare_customer_digital_access_recovery(
  uuid, text, text, uuid, uuid, uuid, text, integer
) from public, anon, authenticated;
revoke all on function public.issue_authenticated_customer_digital_access(
  uuid, uuid, text, uuid, text, integer
) from public, anon, authenticated;
revoke all on function public.authorize_digital_download_access(text)
from public, anon, authenticated;
revoke all on function public.list_authorized_digital_downloads(uuid)
from public, anon, authenticated;

grant execute on function public.record_customer_digital_access_recovery_failure(text, text)
to service_role;
grant execute on function public.prepare_customer_digital_access_recovery(
  uuid, text, text, uuid, uuid, uuid, text, integer
) to service_role;
grant execute on function public.issue_authenticated_customer_digital_access(
  uuid, uuid, text, uuid, text, integer
) to service_role;
grant execute on function public.authorize_digital_download_access(text)
to service_role;
grant execute on function public.list_authorized_digital_downloads(uuid)
to service_role;
