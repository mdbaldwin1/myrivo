-- Digital purchase and merchant-resend email is a durable, audited queue.
-- Bearer values, storage paths, signed URLs, recipients, and provider response
-- bodies never enter these tables. Tokens remain reproducible only from the
-- application secret plus the stored non-secret derivation coordinates.

alter table public.digital_checkout_policy_versions
  add column if not exists access_link_ttl_seconds integer
    not null default 172800
    check (access_link_ttl_seconds between 3600 and 604800);

alter table public.digital_order_access_tokens
  drop constraint if exists digital_order_access_tokens_delivery_derivation_pair_check,
  add constraint digital_order_access_tokens_delivery_derivation_pair_check
    check (
      (
        issuance_reason = 'purchase'
        and (
          (delivery_job_id is null and token_derivation_nonce is null)
          or (delivery_job_id is not null and token_derivation_nonce is not null)
        )
      )
      or (
        issuance_reason in ('customer_request', 'merchant_resend')
        and delivery_job_id is null
      )
    );

-- Normalize prototype-era duplicates before enforcing one active merchant
-- resend. Existing entitlements and grant counters are intentionally untouched.
with ranked_active_resends as (
  select token.id,
         row_number() over (
           partition by token.order_id
           order by token.created_at desc, token.id desc
         ) as active_rank
  from public.digital_order_access_tokens token
  where token.issuance_reason = 'merchant_resend'
    and token.revoked_at is null
)
update public.digital_order_access_tokens token
set revoked_at = now()
from ranked_active_resends ranked
where token.id = ranked.id
  and ranked.active_rank > 1;

create unique index if not exists digital_order_access_tokens_active_merchant_resend_key
  on public.digital_order_access_tokens(order_id)
  where issuance_reason = 'merchant_resend' and revoked_at is null;

create table public.digital_delivery_notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  order_id uuid not null,
  delivery_job_id uuid,
  access_token_id uuid not null,
  notification_type text not null
    check (notification_type in ('purchase', 'merchant_resend')),
  request_key_hash text
    check (request_key_hash is null or request_key_hash ~ '^[a-f0-9]{64}$'),
  requested_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  provider text check (provider is null or provider = 'resend'),
  last_safe_error text
    check (last_safe_error is null or char_length(trim(last_safe_error)) between 1 and 500),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_delivery_notifications_id_order_store_key
    unique (id, order_id, store_id),
  constraint digital_delivery_notifications_order_store_fk
    foreign key (order_id, store_id)
    references public.orders(id, store_id)
    on delete restrict,
  constraint digital_delivery_notifications_job_order_store_fk
    foreign key (delivery_job_id, order_id, store_id)
    references public.digital_delivery_jobs(id, order_id, store_id)
    on delete restrict,
  constraint digital_delivery_notifications_token_order_store_fk
    foreign key (access_token_id, order_id, store_id)
    references public.digital_order_access_tokens(id, order_id, store_id)
    on delete restrict,
  constraint digital_delivery_notifications_kind_check
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
    ),
  constraint digital_delivery_notifications_lifecycle_check
    check (
      (
        status = 'pending' and lease_token is null
        and lease_expires_at is null and sent_at is null
      )
      or (
        status = 'processing' and lease_token is not null
        and lease_expires_at is not null and sent_at is null
      )
      or (
        status = 'succeeded' and lease_token is null
        and lease_expires_at is null and sent_at is not null
        and last_safe_error is null
      )
      or (
        status = 'failed' and lease_token is null
        and lease_expires_at is null and sent_at is null
        and last_safe_error is not null
      )
    ),
  constraint digital_delivery_notifications_timestamps_check
    check (
      updated_at >= created_at
      and next_attempt_at >= created_at
      and (lease_expires_at is null or lease_expires_at > updated_at)
      and (sent_at is null or sent_at >= created_at)
    )
);

create unique index digital_delivery_notifications_purchase_job_key
  on public.digital_delivery_notifications(delivery_job_id)
  where notification_type = 'purchase';

create unique index digital_delivery_notifications_resend_request_key
  on public.digital_delivery_notifications(
    store_id, order_id, notification_type, request_key_hash
  )
  where notification_type = 'merchant_resend';

create index digital_delivery_notifications_claim_idx
  on public.digital_delivery_notifications(next_attempt_at, created_at)
  where status = 'pending';

create table public.digital_delivery_notification_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null,
  order_id uuid not null,
  store_id uuid not null,
  attempt_number integer not null check (attempt_number > 0),
  provider text not null default 'resend' check (provider = 'resend'),
  status text not null check (status in ('processing', 'succeeded', 'failed')),
  safe_error text
    check (safe_error is null or char_length(trim(safe_error)) between 1 and 500),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint digital_delivery_notification_attempts_number_key
    unique (notification_id, attempt_number),
  constraint digital_delivery_notification_attempts_notification_fk
    foreign key (notification_id, order_id, store_id)
    references public.digital_delivery_notifications(id, order_id, store_id)
    on delete cascade,
  constraint digital_delivery_notification_attempts_lifecycle_check
    check (
      (status = 'processing' and finished_at is null and safe_error is null)
      or (status = 'succeeded' and finished_at is not null and safe_error is null)
      or (status = 'failed' and finished_at is not null and safe_error is not null)
    ),
  constraint digital_delivery_notification_attempts_timestamps_check
    check (finished_at is null or finished_at >= started_at)
);

create index digital_delivery_notification_attempts_notification_idx
  on public.digital_delivery_notification_attempts(notification_id, attempt_number desc);

alter table public.digital_delivery_notifications enable row level security;
alter table public.digital_delivery_notification_attempts enable row level security;

create policy digital_delivery_notifications_store_read
on public.digital_delivery_notifications for select
using (public.can_manage_store_membership_for_store(store_id));

create policy digital_delivery_notification_attempts_store_read
on public.digital_delivery_notification_attempts for select
using (public.can_manage_store_membership_for_store(store_id));

create or replace function public.prepare_purchase_digital_delivery_notification(
  p_job_id uuid,
  p_lease_token uuid,
  p_access_token_id uuid
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
  v_job public.digital_delivery_jobs%rowtype;
  v_notification public.digital_delivery_notifications%rowtype;
  v_inserted boolean := false;
begin
  select * into v_job
  from public.digital_delivery_jobs job
  where job.id = p_job_id
  for update;
  if not found
     or v_job.job_type <> 'purchase_delivery'
     or v_job.status <> 'processing'
     or v_job.lease_token is distinct from p_lease_token
     or v_job.lease_expires_at <= clock_timestamp()
  then
    raise exception 'Digital delivery lease is unavailable';
  end if;
  if not exists (
    select 1 from public.digital_order_access_tokens token
    where token.id = p_access_token_id
      and token.order_id = v_job.order_id
      and token.store_id = v_job.store_id
      and token.delivery_job_id = v_job.id
      and token.issuance_reason = 'purchase'
      and token.revoked_at is null
      and token.expires_at > clock_timestamp()
  ) then
    raise exception 'Digital delivery access is unavailable';
  end if;

  insert into public.digital_delivery_notifications(
    store_id, order_id, delivery_job_id, access_token_id,
    notification_type, status, next_attempt_at
  ) values (
    v_job.store_id, v_job.order_id, v_job.id, p_access_token_id,
    'purchase', 'pending', clock_timestamp()
  )
  on conflict (delivery_job_id) where notification_type = 'purchase'
  do nothing;
  get diagnostics v_inserted = row_count;

  select * into v_notification
  from public.digital_delivery_notifications notification
  where notification.delivery_job_id = v_job.id
    and notification.notification_type = 'purchase'
  for update;
  if not found
     or v_notification.access_token_id <> p_access_token_id
     or v_notification.order_id <> v_job.order_id
     or v_notification.store_id <> v_job.store_id
  then
    raise exception 'Digital delivery notification conflicts with access state';
  end if;

  return query select
    v_notification.id, v_notification.access_token_id,
    v_notification.status, not v_inserted;
end;
$$;

create or replace function public.prepare_merchant_digital_delivery_resend(
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
  v_notification public.digital_delivery_notifications%rowtype;
  v_configured_access_ttl_seconds integer;
  v_now timestamptz := clock_timestamp();
begin
  if p_request_key_hash !~ '^[a-f0-9]{64}$'
     or p_token_hash !~ '^[a-f0-9]{64}$'
     or p_token_derivation_nonce is null
     or p_access_ttl_seconds is null
  then
    raise exception 'Digital delivery resend input is invalid';
  end if;
  select policy.access_link_ttl_seconds
  into v_configured_access_ttl_seconds
  from public.digital_checkout_policy_versions policy
  where policy.singleton = true;
  if not found or p_access_ttl_seconds <> v_configured_access_ttl_seconds then
    raise exception 'Digital delivery resend input is invalid';
  end if;
  if not exists (
    select 1 from public.stores store
    where store.id = p_store_id
      and (
        store.owner_user_id = p_actor_user_id
        or exists (
          select 1 from public.store_memberships membership
          where membership.store_id = store.id
            and membership.user_id = p_actor_user_id
            and membership.status = 'active'
            and membership.role in ('owner', 'admin', 'staff')
        )
      )
  ) then
    raise exception 'Digital delivery order is unavailable';
  end if;

  select * into v_order
  from public.orders placed_order
  where placed_order.id = p_order_id
    and placed_order.store_id = p_store_id
  for update;
  if not found then
    raise exception 'Digital delivery order is unavailable';
  end if;
  if v_order.status <> 'paid'
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
     or (
       v_order.total_cents > 0
       and coalesce((
         select sum(refund.amount_cents)
         from public.order_refunds refund
         where refund.order_id = v_order.id
           and refund.store_id = v_order.store_id
           and refund.status = 'succeeded'
       ), 0) >= v_order.total_cents
     )
     or exists (
       select 1 from public.order_disputes dispute
       where dispute.order_id = v_order.id
         and dispute.store_id = v_order.store_id
         and dispute.status in (
           'warning_needs_response', 'warning_under_review',
           'needs_response', 'under_review', 'lost'
         )
     )
  then
    raise exception 'Digital delivery resend is ineligible';
  end if;

  select * into v_notification
  from public.digital_delivery_notifications notification
  where notification.store_id = p_store_id
    and notification.order_id = p_order_id
    and notification.notification_type = 'merchant_resend'
    and notification.request_key_hash = p_request_key_hash
  for update;
  if found then
    return query select
      v_notification.id, v_notification.access_token_id,
      v_notification.status, true;
    return;
  end if;

  update public.digital_order_access_tokens token
  set revoked_at = v_now
  where token.order_id = v_order.id
    and token.store_id = v_order.store_id
    and token.issuance_reason in ('purchase', 'merchant_resend')
    and token.revoked_at is null;

  insert into public.digital_order_access_tokens(
    id, store_id, order_id, delivery_job_id, token_derivation_nonce,
    token_hash, issuance_reason, expires_at, created_at
  ) values (
    p_access_token_id, v_order.store_id, v_order.id, null,
    p_token_derivation_nonce, p_token_hash, 'merchant_resend',
    v_now + make_interval(secs => p_access_ttl_seconds), v_now
  );

  insert into public.digital_delivery_notifications(
    id, store_id, order_id, delivery_job_id, access_token_id,
    notification_type, request_key_hash, requested_by_user_id,
    status, next_attempt_at, created_at, updated_at
  ) values (
    p_notification_id, v_order.store_id, v_order.id, null,
    p_access_token_id, 'merchant_resend', p_request_key_hash,
    p_actor_user_id, 'pending', v_now, v_now, v_now
  ) returning * into v_notification;

  insert into public.audit_events(
    store_id, actor_user_id, action, entity, entity_id, metadata
  ) values (
    v_order.store_id, p_actor_user_id, 'digital_order_delivery_resend_queued',
    'order', v_order.id::text,
    jsonb_build_object(
      'notificationId', v_notification.id,
      'notificationType', v_notification.notification_type,
      'accessTtlHours', p_access_ttl_seconds / 3600
    )
  );

  return query select
    v_notification.id, v_notification.access_token_id,
    v_notification.status, false;
end;
$$;

create or replace function public.claim_digital_delivery_notification(
  p_notification_id uuid,
  p_lease_seconds integer,
  p_max_attempts integer
)
returns table(
  id uuid,
  store_id uuid,
  order_id uuid,
  delivery_job_id uuid,
  access_token_id uuid,
  notification_type text,
  lease_token uuid,
  attempt_number integer,
  token_derivation_nonce uuid,
  token_hash text,
  file_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_notification public.digital_delivery_notifications%rowtype;
  v_token public.digital_order_access_tokens%rowtype;
  v_now timestamptz := clock_timestamp();
  v_lease_token uuid := gen_random_uuid();
  v_file_count integer;
begin
  if p_lease_seconds not between 1 and 3600
     or p_max_attempts not between 1 and 100
  then
    raise exception 'Digital delivery notification claim configuration is invalid';
  end if;

  update public.digital_delivery_notification_attempts attempt
  set status = 'failed', safe_error = 'Notification processing lease expired',
      finished_at = v_now
  from public.digital_delivery_notifications notification
  where attempt.notification_id = notification.id
    and attempt.attempt_number = notification.attempt_count
    and attempt.status = 'processing'
    and notification.status = 'processing'
    and notification.lease_expires_at <= v_now;

  update public.digital_delivery_notifications notification
  set status = case when notification.attempt_count >= p_max_attempts then 'failed' else 'pending' end,
      lease_token = null, lease_expires_at = null,
      last_safe_error = 'Notification processing lease expired',
      next_attempt_at = case
        when notification.attempt_count >= p_max_attempts then notification.next_attempt_at
        else v_now
      end,
      updated_at = v_now
  where notification.status = 'processing'
    and notification.lease_expires_at <= v_now;

  -- Access policy changes win over queued mail. Make the terminal reason safe
  -- and merchant-visible instead of ever sending a newly invalid bearer link.
  update public.digital_delivery_notifications notification
  set status = 'failed', last_safe_error = 'Digital access is no longer eligible',
      lease_token = null, lease_expires_at = null, updated_at = v_now
  where notification.status = 'pending'
    and (
      not exists (
        select 1 from public.digital_order_access_tokens token
        where token.id = notification.access_token_id
          and token.order_id = notification.order_id
          and token.store_id = notification.store_id
          and token.revoked_at is null
          and token.expires_at > v_now
      )
      or not exists (
        select 1 from public.digital_order_entitlements entitlement
        where entitlement.order_id = notification.order_id
          and entitlement.store_id = notification.store_id
          and entitlement.status = 'active'
      )
    );

  select notification.* into v_notification
  from public.digital_delivery_notifications notification
  where notification.status = 'pending'
    and notification.next_attempt_at <= v_now
    and notification.attempt_count < p_max_attempts
    and (p_notification_id is null or notification.id = p_notification_id)
  order by notification.next_attempt_at, notification.created_at, notification.id
  for update skip locked
  limit 1;
  if not found then return; end if;

  select * into v_token
  from public.digital_order_access_tokens token
  where token.id = v_notification.access_token_id
    and token.order_id = v_notification.order_id
    and token.store_id = v_notification.store_id
    and token.revoked_at is null
    and token.expires_at > v_now
  for share;
  if not found or v_token.token_derivation_nonce is null then
    raise exception 'Digital delivery notification token is unavailable';
  end if;

  select count(*)::integer into v_file_count
  from public.digital_order_entitlements entitlement
  where entitlement.order_id = v_notification.order_id
    and entitlement.store_id = v_notification.store_id
    and entitlement.status = 'active';
  if v_file_count <= 0 then
    raise exception 'Digital delivery notification entitlement is unavailable';
  end if;

  update public.digital_delivery_notifications notification
  set status = 'processing', attempt_count = notification.attempt_count + 1,
      lease_token = v_lease_token,
      lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
      updated_at = v_now
  where notification.id = v_notification.id
  returning * into v_notification;

  insert into public.digital_delivery_notification_attempts(
    notification_id, order_id, store_id, attempt_number,
    provider, status, started_at
  ) values (
    v_notification.id, v_notification.order_id, v_notification.store_id,
    v_notification.attempt_count, 'resend', 'processing', v_now
  );

  return query select
    v_notification.id, v_notification.store_id, v_notification.order_id,
    v_notification.delivery_job_id, v_notification.access_token_id,
    v_notification.notification_type, v_notification.lease_token,
    v_notification.attempt_count, v_token.token_derivation_nonce,
    v_token.token_hash, v_file_count;
end;
$$;

create or replace function public.complete_digital_delivery_notification(
  p_notification_id uuid,
  p_lease_token uuid,
  p_outcome text,
  p_provider text,
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
  v_notification public.digital_delivery_notifications%rowtype;
  v_now timestamptz := clock_timestamp();
  v_safe_error text;
  v_retry_seconds integer;
begin
  if p_outcome not in ('succeeded', 'failed')
     or p_provider <> 'resend'
     or p_max_attempts not between 1 and 100
     or p_retry_base_seconds not between 1 and 86400
     or p_retry_max_seconds not between p_retry_base_seconds and 604800
  then
    raise exception 'Digital delivery notification completion input is invalid';
  end if;

  select * into v_notification
  from public.digital_delivery_notifications notification
  where notification.id = p_notification_id
  for update;
  if not found
     or v_notification.status <> 'processing'
     or v_notification.lease_token is distinct from p_lease_token
     or v_notification.lease_expires_at <= v_now
  then
    raise exception 'Digital delivery notification lease is unavailable';
  end if;

  if p_outcome = 'succeeded' then
    update public.digital_delivery_notification_attempts
    set status = 'succeeded', provider = p_provider,
        safe_error = null, finished_at = v_now
    where notification_id = v_notification.id
      and attempt_number = v_notification.attempt_count
      and status = 'processing';
    if not found then
      raise exception 'Digital delivery notification attempt is unavailable';
    end if;
    update public.digital_delivery_notifications
    set status = 'succeeded', lease_token = null, lease_expires_at = null,
        provider = p_provider, last_safe_error = null, sent_at = v_now,
        updated_at = v_now
    where id = v_notification.id;
    insert into public.audit_events(
      store_id, actor_user_id, action, entity, entity_id, metadata
    ) values (
      v_notification.store_id, v_notification.requested_by_user_id,
      'digital_order_delivery_sent', 'order', v_notification.order_id::text,
      jsonb_build_object(
        'notificationId', v_notification.id,
        'notificationType', v_notification.notification_type,
        'provider', p_provider,
        'attemptNumber', v_notification.attempt_count
      )
    );
    return jsonb_build_object('status', 'succeeded', 'next_attempt_at', null);
  end if;

  v_safe_error := nullif(left(trim(coalesce(p_safe_error, '')), 500), '');
  if v_safe_error is null
     or v_safe_error ~* '(authorization\s*:\s*bearer|api[_ -]?key|secret|https?://\S+/downloads/|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:private|digital-product-assets)/|\mreq_[A-Za-z0-9_-]+)'
  then
    v_safe_error := 'Digital delivery notification failed';
  end if;

  update public.digital_delivery_notification_attempts
  set status = 'failed', provider = p_provider,
      safe_error = v_safe_error, finished_at = v_now
  where notification_id = v_notification.id
    and attempt_number = v_notification.attempt_count
    and status = 'processing';
  if not found then
    raise exception 'Digital delivery notification attempt is unavailable';
  end if;

  if v_notification.attempt_count >= p_max_attempts then
    update public.digital_delivery_notifications
    set status = 'failed', lease_token = null, lease_expires_at = null,
        provider = p_provider, last_safe_error = v_safe_error, sent_at = null,
        updated_at = v_now
    where id = v_notification.id;
    insert into public.audit_events(
      store_id, actor_user_id, action, entity, entity_id, metadata
    ) values (
      v_notification.store_id, v_notification.requested_by_user_id,
      'digital_order_delivery_failed', 'order', v_notification.order_id::text,
      jsonb_build_object(
        'notificationId', v_notification.id,
        'notificationType', v_notification.notification_type,
        'provider', p_provider,
        'attemptNumber', v_notification.attempt_count,
        'safeError', v_safe_error
      )
    );
    return jsonb_build_object('status', 'failed', 'next_attempt_at', null);
  end if;

  v_retry_seconds := least(
    p_retry_max_seconds::numeric,
    p_retry_base_seconds::numeric * power(2::numeric, v_notification.attempt_count - 1)
  )::integer;
  update public.digital_delivery_notifications
  set status = 'pending', lease_token = null, lease_expires_at = null,
      provider = p_provider, last_safe_error = v_safe_error,
      next_attempt_at = v_now + make_interval(secs => v_retry_seconds),
      sent_at = null, updated_at = v_now
  where id = v_notification.id;
  return jsonb_build_object(
    'status', 'pending',
    'next_attempt_at', v_now + make_interval(secs => v_retry_seconds)
  );
end;
$$;

revoke all on function public.prepare_purchase_digital_delivery_notification(uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.prepare_merchant_digital_delivery_resend(
  uuid, uuid, uuid, text, uuid, uuid, uuid, text, integer
) from public, anon, authenticated;
revoke all on function public.claim_digital_delivery_notification(uuid, integer, integer)
from public, anon, authenticated;
revoke all on function public.complete_digital_delivery_notification(
  uuid, uuid, text, text, text, integer, integer, integer
) from public, anon, authenticated;

grant execute on function public.prepare_purchase_digital_delivery_notification(uuid, uuid, uuid)
to service_role;
grant execute on function public.prepare_merchant_digital_delivery_resend(
  uuid, uuid, uuid, text, uuid, uuid, uuid, text, integer
) to service_role;
grant execute on function public.claim_digital_delivery_notification(uuid, integer, integer)
to service_role;
grant execute on function public.complete_digital_delivery_notification(
  uuid, uuid, text, text, text, integer, integer, integer
) to service_role;
