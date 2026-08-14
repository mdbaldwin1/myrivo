-- Fix 1: align plan eligibility, close the settlement race, make explicit
-- delivery repair usable, serialize operator idempotency, and type telemetry.

-- A paid order is the first irreversible sale-side row. Lock and validate its
-- checkout before the atomic checkout wrapper can create order or inventory
-- state. Completed orders and non-digital checkouts are deliberately outside
-- this guard so paid-order repair and physical checkout remain available.
create or replace function public.enforce_digital_checkout_settlement_rollout()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_checkout public.storefront_checkout_sessions%rowtype;
begin
  if new.status <> 'paid' or new.storefront_checkout_session_id is null then
    return new;
  end if;

  select * into v_checkout
  from public.storefront_checkout_sessions checkout
  where checkout.id = new.storefront_checkout_session_id
    and checkout.store_id = new.store_id
  for update;

  if found
     and v_checkout.status = 'pending'
     and v_checkout.checkout_composition in ('digital_only', 'mixed')
     and not public.is_store_digital_products_enabled(new.store_id)
  then
    raise exception 'Digital checkout settlement is unavailable for this store';
  end if;
  return new;
end;
$$;

create trigger enforce_digital_checkout_settlement_rollout
before insert on public.orders
for each row execute function public.enforce_digital_checkout_settlement_rollout();

revoke all on function public.enforce_digital_checkout_settlement_rollout()
  from public, anon, authenticated;

-- attempt_count remains a monotonic identity used by the attempt ledger.
-- generation_attempt_count is the bounded worker budget that an audited
-- operator repair may reset without colliding with historical attempt rows.
alter table public.digital_delivery_jobs
  add column repair_generation integer not null default 0
    check (repair_generation >= 0),
  add column generation_attempt_count integer not null default 0
    check (generation_attempt_count >= 0);

update public.digital_delivery_jobs
set generation_attempt_count = attempt_count;

create or replace function public.claim_digital_delivery_job(
  p_lease_seconds integer,
  p_max_attempts integer
)
returns table(
  id uuid,
  store_id uuid,
  order_id uuid,
  manifest_id uuid,
  status text,
  lease_token uuid,
  attempt_number integer,
  notification_sent_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.digital_delivery_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
  v_lease_token uuid := gen_random_uuid();
begin
  if p_lease_seconds not between 1 and 3600
     or p_max_attempts not between 1 and 100
  then
    raise exception 'Digital delivery claim configuration is invalid';
  end if;

  update public.digital_delivery_attempts attempt
  set status = 'failed', safe_error = 'Processing lease expired',
      finished_at = v_now
  from public.digital_delivery_jobs job
  where attempt.job_id = job.id
    and attempt.attempt_number = job.attempt_count
    and attempt.status = 'processing'
    and job.status = 'processing'
    and job.lease_expires_at <= v_now
    and job.generation_attempt_count >= p_max_attempts;

  update public.digital_delivery_jobs job
  set status = 'failed', lease_expires_at = null, lease_token = null,
      last_safe_error = 'Processing lease expired', completed_at = v_now,
      updated_at = v_now
  where job.status = 'processing'
    and job.lease_expires_at <= v_now
    and job.generation_attempt_count >= p_max_attempts;

  select job.* into v_job
  from public.digital_delivery_jobs job
  where job.job_type = 'purchase_delivery'
    and job.manifest_id is not null
    and job.generation_attempt_count < p_max_attempts
    and (
      (job.status = 'pending' and job.next_attempt_at <= v_now)
      or (job.status = 'processing' and job.lease_expires_at <= v_now)
    )
  order by job.next_attempt_at, job.created_at, job.id
  for update skip locked
  limit 1;

  if not found then return; end if;

  if v_job.status = 'processing' then
    update public.digital_delivery_attempts attempt
    set status = 'failed', safe_error = 'Processing lease expired',
        finished_at = v_now
    where attempt.job_id = v_job.id
      and attempt.attempt_number = v_job.attempt_count
      and attempt.status = 'processing';
  end if;

  update public.digital_delivery_jobs job
  set status = 'processing',
      attempt_count = job.attempt_count + 1,
      generation_attempt_count = job.generation_attempt_count + 1,
      lease_token = v_lease_token,
      lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
      completed_at = null,
      updated_at = v_now
  where job.id = v_job.id
  returning job.* into v_job;

  insert into public.digital_delivery_attempts(
    job_id, order_id, store_id, attempt_number, status, started_at
  ) values (
    v_job.id, v_job.order_id, v_job.store_id,
    v_job.attempt_count, 'processing', v_now
  );

  return query select
    v_job.id, v_job.store_id, v_job.order_id, v_job.manifest_id,
    v_job.status, v_job.lease_token, v_job.attempt_count,
    v_job.notification_sent_at;
end;
$$;

create or replace function public.complete_digital_delivery_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_outcome text,
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
  v_job public.digital_delivery_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
  v_safe_error text;
  v_retry_seconds integer;
begin
  if p_outcome not in ('succeeded', 'failed')
     or p_max_attempts not between 1 and 100
     or p_retry_base_seconds not between 1 and 86400
     or p_retry_max_seconds not between p_retry_base_seconds and 604800
  then
    raise exception 'Digital delivery completion input is invalid';
  end if;

  select * into v_job
  from public.digital_delivery_jobs job
  where job.id = p_job_id
  for update;
  if not found
     or v_job.status <> 'processing'
     or v_job.lease_token is distinct from p_lease_token
     or v_job.lease_expires_at <= v_now
  then
    raise exception 'Digital delivery lease is unavailable';
  end if;

  if p_outcome = 'succeeded' then
    if v_job.notification_sent_at is null
       or not exists (
         select 1 from public.digital_order_entitlements entitlement
         where entitlement.order_id = v_job.order_id
       )
       or not exists (
         select 1 from public.digital_order_access_tokens token
         where token.delivery_job_id = v_job.id
           and token.issuance_reason = 'purchase'
           and token.revoked_at is null
       )
    then
      raise exception 'Digital delivery cannot complete before durable delivery';
    end if;

    update public.digital_delivery_attempts
    set status = 'succeeded', finished_at = v_now
    where job_id = v_job.id
      and attempt_number = v_job.attempt_count
      and status = 'processing';
    if not found then
      raise exception 'Digital delivery attempt is unavailable';
    end if;

    update public.digital_delivery_jobs
    set status = 'succeeded', lease_expires_at = null, lease_token = null,
        last_safe_error = null, completed_at = v_now, updated_at = v_now
    where id = v_job.id;
    return jsonb_build_object('status', 'succeeded', 'next_attempt_at', null);
  end if;

  v_safe_error := nullif(left(trim(coalesce(p_safe_error, '')), 500), '');
  if v_safe_error is null then
    v_safe_error := 'Digital delivery attempt failed';
  end if;
  if v_safe_error ~* '(authorization\s*:\s*bearer|api[_ -]?key|secret|https?://\S+/downloads/|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})' then
    v_safe_error := 'Digital delivery attempt failed';
  end if;

  update public.digital_delivery_attempts
  set status = 'failed', safe_error = v_safe_error, finished_at = v_now
  where job_id = v_job.id
    and attempt_number = v_job.attempt_count
    and status = 'processing';
  if not found then
    raise exception 'Digital delivery attempt is unavailable';
  end if;

  if v_job.generation_attempt_count >= p_max_attempts then
    update public.digital_delivery_jobs
    set status = 'failed', lease_expires_at = null, lease_token = null,
        last_safe_error = v_safe_error, completed_at = v_now, updated_at = v_now
    where id = v_job.id;
    return jsonb_build_object('status', 'failed', 'next_attempt_at', null);
  end if;

  v_retry_seconds := least(
    p_retry_max_seconds::numeric,
    p_retry_base_seconds::numeric * power(2::numeric, v_job.generation_attempt_count - 1)
  )::integer;
  update public.digital_delivery_jobs
  set status = 'pending', lease_expires_at = null, lease_token = null,
      last_safe_error = v_safe_error,
      next_attempt_at = v_now + make_interval(secs => v_retry_seconds),
      completed_at = null, updated_at = v_now
  where id = v_job.id;
  return jsonb_build_object(
    'status', 'pending',
    'next_attempt_at', v_now + make_interval(secs => v_retry_seconds)
  );
end;
$$;

-- Event and dimension pairs are closed schemas. Every string is an enum and
-- every counter is a bounded integer; no merchant-entered strings are valid.
create or replace function public.digital_product_event_dimensions_are_safe(
  p_event_type text,
  p_dimensions jsonb
)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = public, pg_temp
as $$
declare
  v_attempt numeric;
begin
  if jsonb_typeof(p_dimensions) <> 'object' then return false; end if;

  if p_event_type = 'upload_failed' then
    return p_dimensions in (
      '{"stage":"upload","outcome":"failed"}'::jsonb,
      '{"stage":"completion","outcome":"failed"}'::jsonb
    );
  elsif p_event_type = 'preview_failed' then
    return p_dimensions in (
      '{"stage":"preview","outcome":"failed"}'::jsonb,
      '{"stage":"completion","outcome":"failed"}'::jsonb
    );
  elsif p_event_type = 'manifest_failed' then
    return p_dimensions in (
      '{"stage":"checkout_manifest","outcome":"failed","composition":"digital_only"}'::jsonb,
      '{"stage":"checkout_manifest","outcome":"failed","composition":"mixed"}'::jsonb
    );
  elsif p_event_type = 'delivery_job_aged' then
    return p_dimensions in (
      '{"ageBucket":"5m_to_30m"}'::jsonb,
      '{"ageBucket":"30m_plus"}'::jsonb
    );
  elsif p_event_type = 'delivery_job_failed' then
    if not (p_dimensions ? 'attemptNumber')
       or p_dimensions - 'attemptNumber' <> '{"outcome":"failed"}'::jsonb
       or jsonb_typeof(p_dimensions -> 'attemptNumber') <> 'number'
    then return false; end if;
    v_attempt := (p_dimensions ->> 'attemptNumber')::numeric;
    return v_attempt = trunc(v_attempt) and v_attempt between 0 and 10000;
  elsif p_event_type = 'delivery_email_attempted' then
    if not (p_dimensions ?& array['notificationType', 'outcome', 'attemptNumber'])
       or p_dimensions - array['notificationType', 'outcome', 'attemptNumber'] <> '{}'::jsonb
       or p_dimensions ->> 'notificationType' not in ('purchase', 'merchant_resend', 'customer_recovery', 'refund', 'dispute')
       or p_dimensions ->> 'outcome' not in ('queued', 'pending', 'processing', 'succeeded', 'failed', 'denied')
       or jsonb_typeof(p_dimensions -> 'attemptNumber') <> 'number'
    then return false; end if;
    v_attempt := (p_dimensions ->> 'attemptNumber')::numeric;
    return v_attempt = trunc(v_attempt) and v_attempt between 0 and 10000;
  elsif p_event_type = 'access_link_regenerated' then
    return p_dimensions in (
      '{"notificationType":"merchant_resend","outcome":"queued"}'::jsonb,
      '{"notificationType":"customer_recovery","outcome":"queued"}'::jsonb
    );
  elsif p_event_type = 'download_signing_failed' then
    return p_dimensions = '{"stage":"storage_signing","outcome":"failed"}'::jsonb;
  elsif p_event_type = 'grant_exhausted' then
    return p_dimensions = '{"stage":"reservation","outcome":"denied"}'::jsonb;
  elsif p_event_type = 'reconciliation_mismatch' then
    return p_dimensions in (
      '{"issueType":"paid_order_missing_entitlements"}'::jsonb,
      '{"issueType":"full_refund_active_access"}'::jsonb,
      '{"issueType":"open_dispute_access_mismatch"}'::jsonb,
      '{"issueType":"lost_dispute_access_mismatch"}'::jsonb,
      '{"issueType":"token_access_mismatch"}'::jsonb
    );
  elsif p_event_type = 'refund_transition' then
    return p_dimensions in (
      '{"outcome":"requested"}'::jsonb,
      '{"outcome":"processing"}'::jsonb,
      '{"outcome":"succeeded"}'::jsonb,
      '{"outcome":"failed"}'::jsonb,
      '{"outcome":"cancelled"}'::jsonb
    );
  elsif p_event_type = 'dispute_transition' then
    return coalesce(p_dimensions ? 'disputeStatus' and p_dimensions ->> 'disputeStatus' in (
      'warning_needs_response', 'warning_under_review', 'warning_closed',
      'needs_response', 'under_review', 'won', 'lost', 'prevented'
    ) and p_dimensions - 'disputeStatus' = '{}'::jsonb, false);
  end if;
  return false;
end;
$$;

alter table public.digital_product_events
  drop constraint digital_product_events_dimensions_check;
delete from public.digital_product_events event
where not public.digital_product_event_dimensions_are_safe(event.event_type, event.dimensions);
alter table public.digital_product_events
  add constraint digital_product_events_dimensions_check
  check (public.digital_product_event_dimensions_are_safe(event_type, dimensions));
drop function public.digital_product_event_dimensions_are_safe(jsonb);

-- Serialize the duplicate check and mutation under the same transaction lock.
create or replace function public.set_store_digital_products_enabled(
  p_store_id uuid,
  p_enabled boolean,
  p_actor_user_id uuid,
  p_idempotency_key text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_action text := case when p_enabled then 'rollout_enabled' else 'rollout_disabled' end;
  v_request_hash text;
  v_previous boolean;
begin
  if p_store_id is null or p_actor_user_id is null
     or p_enabled is null
     or coalesce(char_length(trim(p_idempotency_key)), 0) not between 8 and 200
  then raise exception 'Valid rollout operation context is required'; end if;
  if not exists (select 1 from public.stores where id = p_store_id) then
    raise exception 'Store is unavailable';
  end if;

  v_request_hash := encode(sha256(convert_to(trim(p_idempotency_key), 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    p_store_id::text || ':' || v_action || ':' || v_request_hash, 0
  ));
  if exists (
    select 1 from public.digital_product_operator_actions
    where store_id = p_store_id and action = v_action
      and request_key_hash = v_request_hash
  ) then return public.is_store_digital_products_enabled(p_store_id); end if;

  select digital_products into v_previous
  from public.store_feature_flags
  where store_id = p_store_id
  for update;

  insert into public.store_feature_flags(
    store_id, digital_products, updated_by_user_id, updated_at
  ) values (p_store_id, p_enabled, p_actor_user_id, now())
  on conflict (store_id) do update
  set digital_products = excluded.digital_products,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = excluded.updated_at;

  insert into public.digital_product_operator_actions(
    store_id, actor_user_id, action, request_key_hash, outcome
  ) values (
    p_store_id, p_actor_user_id, v_action, v_request_hash,
    case when v_previous is not distinct from p_enabled then 'noop' else 'applied' end
  );
  insert into public.audit_events(store_id, actor_user_id, action, entity, entity_id, metadata)
  values (
    p_store_id, p_actor_user_id, 'digital_products_rollout_changed',
    'store_feature_flags', p_store_id::text, jsonb_build_object('enabled', p_enabled)
  );
  return public.is_store_digital_products_enabled(p_store_id);
end;
$$;

create or replace function public.requeue_digital_delivery(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_user_id uuid,
  p_idempotency_key text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_hash text;
  v_changed integer;
  v_repair_generation integer;
  v_prior_attempt_count integer;
begin
  if p_store_id is null or p_order_id is null or p_actor_user_id is null
     or coalesce(char_length(trim(p_idempotency_key)), 0) not between 8 and 200
  then raise exception 'Valid operation context is required'; end if;
  v_request_hash := encode(sha256(convert_to(trim(p_idempotency_key), 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    p_store_id::text || ':delivery_requeued:' || v_request_hash, 0
  ));
  if exists (
    select 1 from public.digital_product_operator_actions
    where store_id = p_store_id and action = 'delivery_requeued'
      and request_key_hash = v_request_hash
  ) then return 'noop'; end if;

  update public.digital_delivery_jobs job
  set status = 'pending', next_attempt_at = now(), lease_expires_at = null,
      lease_token = null, completed_at = null, last_safe_error = null,
      repair_generation = job.repair_generation + 1,
      generation_attempt_count = 0,
      updated_at = now()
  where job.store_id = p_store_id and job.order_id = p_order_id
    and job.job_type = 'purchase_delivery' and job.status in ('pending', 'failed')
  returning job.repair_generation, job.attempt_count
  into v_repair_generation, v_prior_attempt_count;
  get diagnostics v_changed = row_count;
  if v_changed = 0 then raise exception 'Retryable digital delivery is unavailable'; end if;

  insert into public.digital_product_operator_actions(
    store_id, order_id, actor_user_id, action, request_key_hash, outcome
  ) values (
    p_store_id, p_order_id, p_actor_user_id, 'delivery_requeued',
    v_request_hash, 'applied'
  );
  insert into public.audit_events(store_id, actor_user_id, action, entity, entity_id, metadata)
  values (
    p_store_id, p_actor_user_id, 'digital_delivery_requeued', 'order',
    p_order_id::text, jsonb_build_object(
      'repairGeneration', v_repair_generation,
      'priorAttemptCount', v_prior_attempt_count
    )
  );
  return 'applied';
end;
$$;

create or replace function public.reconcile_digital_order_access(
  p_store_id uuid,
  p_order_id uuid,
  p_actor_user_id uuid,
  p_idempotency_key text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_hash text;
begin
  if p_store_id is null or p_order_id is null or p_actor_user_id is null
     or coalesce(char_length(trim(p_idempotency_key)), 0) not between 8 and 200
  then raise exception 'Valid operation context is required'; end if;
  if not exists (
    select 1 from public.orders where id = p_order_id and store_id = p_store_id
  ) then raise exception 'Digital order is unavailable'; end if;

  v_request_hash := encode(sha256(convert_to(trim(p_idempotency_key), 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    p_store_id::text || ':access_reconciled:' || v_request_hash, 0
  ));
  if exists (
    select 1 from public.digital_product_operator_actions
    where store_id = p_store_id and action = 'access_reconciled'
      and request_key_hash = v_request_hash
  ) then return 'noop'; end if;

  perform public.apply_digital_financial_access_state(p_order_id, null);
  perform public.enqueue_digital_delivery(p_order_id, manifest.id)
  from public.digital_purchase_manifests manifest
  where manifest.order_id = p_order_id and manifest.store_id = p_store_id
    and manifest.status = 'locked'
    and exists (select 1 from public.orders where id = p_order_id and status = 'paid')
    and not exists (
      select 1 from public.digital_delivery_jobs job
      where job.order_id = p_order_id and job.job_type = 'purchase_delivery'
    );

  insert into public.digital_product_operator_actions(
    store_id, order_id, actor_user_id, action, request_key_hash, outcome
  ) values (
    p_store_id, p_order_id, p_actor_user_id, 'access_reconciled',
    v_request_hash, 'applied'
  );
  insert into public.audit_events(store_id, actor_user_id, action, entity, entity_id, metadata)
  values (
    p_store_id, p_actor_user_id, 'digital_access_reconciled',
    'order', p_order_id::text, '{}'::jsonb
  );
  return 'applied';
end;
$$;

-- Surface global history and current repair budget separately.
drop function public.get_digital_delivery_health(integer);
create function public.get_digital_delivery_health(
  p_limit integer default 100
)
returns table(
  issue_type text,
  store_id uuid,
  order_id uuid,
  job_id uuid,
  status text,
  attempt_count integer,
  repair_generation integer,
  generation_attempt_count integer,
  age_minutes integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with pending as (
    select 'paid_delivery_pending_over_5m'::text as issue_type,
      placed_order.store_id, placed_order.id as order_id,
      job.id as job_id, coalesce(job.status, 'missing')::text as status,
      coalesce(job.attempt_count, 0)::integer as attempt_count,
      coalesce(job.repair_generation, 0)::integer as repair_generation,
      coalesce(job.generation_attempt_count, 0)::integer as generation_attempt_count,
      greatest(0, floor(extract(epoch from (now() - placed_order.created_at)) / 60))::integer as age_minutes
    from public.orders placed_order
    join public.order_items item on item.order_id = placed_order.id and item.product_type = 'digital'
    left join public.digital_delivery_jobs job
      on job.order_id = placed_order.id and job.job_type = 'purchase_delivery'
    where placed_order.status = 'paid'
      and placed_order.created_at <= now() - interval '5 minutes'
      and coalesce(job.status, 'missing') <> 'succeeded'
    group by placed_order.store_id, placed_order.id, job.id, job.status,
      job.attempt_count, job.repair_generation, job.generation_attempt_count,
      placed_order.created_at
  ), repeated as (
    select 'repeated_delivery_failures'::text,
      job.store_id, job.order_id, job.id, job.status,
      job.attempt_count, job.repair_generation, job.generation_attempt_count,
      greatest(0, floor(extract(epoch from (now() - job.created_at)) / 60))::integer
    from public.digital_delivery_jobs job
    where job.status = 'failed' and job.generation_attempt_count >= 3
  ), mismatches as (
    select 'access_state_mismatch'::text,
      issue.store_id, issue.order_id, null::uuid,
      issue.issue_type::text, 0::integer, 0::integer, 0::integer,
      greatest(0, floor(extract(epoch from (now() - placed_order.created_at)) / 60))::integer
    from public.find_digital_access_reconciliation_issues(
      greatest(1, least(coalesce(p_limit, 100), 500))
    ) issue
    join public.orders placed_order on placed_order.id = issue.order_id
    where issue.issue_type not in ('paid_order_missing_delivery_job')
  )
  select * from (
    select * from pending
    union all select * from repeated
    union all select * from mismatches
  ) health
  order by age_minutes desc, issue_type, order_id
  limit greatest(1, least(coalesce(p_limit, 100), 500))
$$;

revoke all on function public.get_digital_delivery_health(integer)
  from public, anon, authenticated;
grant execute on function public.get_digital_delivery_health(integer)
  to service_role;
revoke all on function public.claim_digital_delivery_job(integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_digital_delivery_job(uuid, uuid, text, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_digital_delivery_job(integer, integer)
  to service_role;
grant execute on function public.complete_digital_delivery_job(uuid, uuid, text, text, integer, integer, integer)
  to service_role;
