-- Digital products are released with two independent controls: the billing
-- plan must make the capability eligible and a platform operator must enable
-- the individual store. Missing or malformed state always fails closed.

update public.billing_plans
set feature_flags_json = jsonb_set(
  coalesce(feature_flags_json, '{}'::jsonb),
  '{digitalProducts}',
  'false'::jsonb,
  true
), updated_at = now()
where not (coalesce(feature_flags_json, '{}'::jsonb) ? 'digitalProducts');

create table public.store_feature_flags (
  store_id uuid primary key references public.stores(id) on delete cascade,
  digital_products boolean not null default false,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index store_feature_flags_digital_products_enabled_idx
  on public.store_feature_flags(store_id)
  where digital_products;

alter table public.store_feature_flags enable row level security;

create or replace function public.is_store_digital_products_enabled(
  p_store_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select store_flags.digital_products
      and plan.active
      and plan.feature_flags_json -> 'digitalProducts' = 'true'::jsonb
    from public.store_feature_flags store_flags
    join public.store_billing_profiles profile
      on profile.store_id = store_flags.store_id
    join public.billing_plans plan
      on plan.id = profile.billing_plan_id
    where store_flags.store_id = p_store_id
  ), false)
$$;

revoke all on function public.is_store_digital_products_enabled(uuid)
  from public, anon, authenticated;
grant execute on function public.is_store_digital_products_enabled(uuid)
  to service_role;

create table public.digital_product_operator_actions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in (
    'rollout_enabled', 'rollout_disabled', 'delivery_requeued',
    'delivery_resent', 'access_reconciled'
  )),
  request_key_hash text not null check (request_key_hash ~ '^[a-f0-9]{64}$'),
  outcome text not null check (outcome in ('applied', 'noop')),
  created_at timestamptz not null default now(),
  unique (store_id, action, request_key_hash)
);

create index digital_product_operator_actions_store_created_idx
  on public.digital_product_operator_actions(store_id, created_at desc);

alter table public.digital_product_operator_actions enable row level security;

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
     or coalesce(char_length(trim(p_idempotency_key)), 0) not between 8 and 200
  then
    raise exception 'Valid rollout operation context is required';
  end if;
  if not exists (select 1 from public.stores where id = p_store_id) then
    raise exception 'Store is unavailable';
  end if;

  v_request_hash := encode(digest(trim(p_idempotency_key), 'sha256'), 'hex');
  if exists (
    select 1 from public.digital_product_operator_actions
    where store_id = p_store_id and action = v_action and request_key_hash = v_request_hash
  ) then
    return public.is_store_digital_products_enabled(p_store_id);
  end if;

  select digital_products into v_previous
  from public.store_feature_flags
  where store_id = p_store_id
  for update;

  insert into public.store_feature_flags(
    store_id, digital_products, updated_by_user_id, updated_at
  ) values (
    p_store_id, p_enabled, p_actor_user_id, now()
  )
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
    'store_feature_flags', p_store_id::text,
    jsonb_build_object('enabled', p_enabled)
  );

  return public.is_store_digital_products_enabled(p_store_id);
end;
$$;

revoke all on function public.set_store_digital_products_enabled(uuid, boolean, uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_store_digital_products_enabled(uuid, boolean, uuid, text)
  to service_role;

-- DB-authoritative gates. Application checks improve UX, but bypassing an API
-- cannot create new catalog or sale state while the store rollout is disabled.
create or replace function public.enforce_digital_product_catalog_rollout()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.product_type = 'digital'
     and not public.is_store_digital_products_enabled(new.store_id)
     and not (
       tg_op = 'UPDATE'
       and old.product_type = 'digital'
       and new.status = 'archived'
     )
  then
    raise exception 'Digital products are not enabled for this store';
  end if;
  return new;
end;
$$;

create trigger enforce_digital_product_catalog_rollout
before insert or update on public.products
for each row execute function public.enforce_digital_product_catalog_rollout();

create or replace function public.enforce_digital_asset_rollout()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_store_id uuid := case when tg_op = 'DELETE' then old.store_id else new.store_id end;
begin
  if not public.is_store_digital_products_enabled(v_store_id) then
    raise exception 'Digital products are not enabled for this store';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger enforce_digital_asset_rollout
before insert or update or delete on public.digital_product_assets
for each row execute function public.enforce_digital_asset_rollout();
create trigger enforce_digital_asset_version_rollout
before insert or update or delete on public.digital_product_asset_versions
for each row execute function public.enforce_digital_asset_rollout();
create trigger enforce_digital_preview_rollout
before insert or update or delete on public.digital_product_previews
for each row execute function public.enforce_digital_asset_rollout();
create trigger enforce_digital_upload_intent_rollout
before insert or update or delete on public.digital_asset_upload_intents
for each row execute function public.enforce_digital_asset_rollout();

create or replace function public.enforce_digital_checkout_rollout()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_has_digital boolean;
begin
  select exists (
    select 1
    from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) requested_item
    join public.products product
      on product.id = (requested_item ->> 'productId')::uuid
     and product.store_id = new.store_id
    where product.product_type = 'digital'
  ) into v_has_digital;

  if v_has_digital
     and not public.is_store_digital_products_enabled(new.store_id)
     and (tg_op = 'INSERT' or new.status = 'pending')
  then
    raise exception 'Digital checkout is not enabled for this store';
  end if;
  return new;
end;
$$;

create trigger enforce_digital_checkout_rollout
before insert or update on public.storefront_checkout_sessions
for each row execute function public.enforce_digital_checkout_rollout();

create or replace function public.enforce_digital_manifest_rollout()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not public.is_store_digital_products_enabled(new.store_id) then
    raise exception 'Digital checkout is not enabled for this store';
  end if;
  return new;
end;
$$;

create trigger enforce_digital_manifest_rollout
before insert on public.digital_purchase_manifests
for each row execute function public.enforce_digital_manifest_rollout();

-- Privacy-safe operational telemetry deliberately has no free-form message,
-- path, email, URL, or token columns. Dimension keys are tightly bounded.
create or replace function public.digital_product_event_dimensions_are_safe(
  p_dimensions jsonb
)
returns boolean
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select jsonb_typeof(p_dimensions) = 'object'
    and not exists (
      select 1 from jsonb_object_keys(p_dimensions) key
      where key not in (
        'stage', 'outcome', 'reasonCode', 'attemptNumber', 'ageBucket',
        'issueType', 'composition', 'notificationType', 'accessState',
        'refundScope', 'disputeStatus'
      )
    )
    and not exists (
      select 1 from jsonb_each_text(p_dimensions) dimension
      where dimension.value ~* '(@|https?://|bearer|authorization|token|[/\\])'
    )
$$;

create table public.digital_product_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  event_type text not null check (event_type in (
    'upload_failed', 'preview_failed', 'manifest_failed',
    'delivery_job_aged', 'delivery_job_failed', 'delivery_email_attempted',
    'access_link_regenerated', 'download_signing_failed', 'grant_exhausted',
    'reconciliation_mismatch', 'refund_transition', 'dispute_transition'
  )),
  dimensions jsonb not null default '{}'::jsonb
    check (public.digital_product_event_dimensions_are_safe(dimensions)),
  created_at timestamptz not null default now()
);

create index digital_product_events_type_created_idx
  on public.digital_product_events(event_type, created_at desc);
create index digital_product_events_store_created_idx
  on public.digital_product_events(store_id, created_at desc);
alter table public.digital_product_events enable row level security;

create or replace function public.capture_digital_product_operational_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_type text;
  v_store_id uuid;
  v_order_id uuid;
  v_product_id uuid;
  v_dimensions jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'digital_asset_upload_intents' then
    if new.status <> 'failed' or (tg_op = 'UPDATE' and old.status = new.status) then return new; end if;
    v_event_type := 'upload_failed'; v_store_id := new.store_id; v_product_id := new.product_id;
    v_dimensions := jsonb_build_object('stage', 'upload', 'outcome', 'failed');
  elsif tg_table_name = 'digital_product_previews' then
    if new.status <> 'failed' or (tg_op = 'UPDATE' and old.status = new.status) then return new; end if;
    v_event_type := 'preview_failed'; v_store_id := new.store_id; v_product_id := new.product_id;
    v_dimensions := jsonb_build_object('stage', 'preview', 'outcome', 'failed');
  elsif tg_table_name = 'digital_delivery_jobs' then
    if new.status <> 'failed' or (tg_op = 'UPDATE' and old.status = new.status) then return new; end if;
    v_event_type := 'delivery_job_failed'; v_store_id := new.store_id; v_order_id := new.order_id;
    v_dimensions := jsonb_build_object('outcome', 'failed', 'attemptNumber', new.attempt_count);
  elsif tg_table_name = 'digital_delivery_notifications' then
    if tg_op = 'INSERT' and new.notification_type in ('merchant_resend', 'customer_recovery') then
      v_event_type := 'access_link_regenerated'; v_store_id := new.store_id; v_order_id := new.order_id;
      v_dimensions := jsonb_build_object('notificationType', new.notification_type, 'outcome', 'queued');
    elsif tg_op = 'UPDATE' and new.attempt_count > old.attempt_count then
      v_event_type := 'delivery_email_attempted'; v_store_id := new.store_id; v_order_id := new.order_id;
      v_dimensions := jsonb_build_object('notificationType', new.notification_type, 'outcome', new.status, 'attemptNumber', new.attempt_count);
    else return new; end if;
  elsif tg_table_name = 'order_refunds' then
    if tg_op = 'UPDATE' and old.status = new.status then return new; end if;
    if not exists (select 1 from public.order_items where order_id = new.order_id and product_type = 'digital') then return new; end if;
    v_event_type := 'refund_transition'; v_store_id := new.store_id; v_order_id := new.order_id;
    v_dimensions := jsonb_build_object('outcome', new.status);
  elsif tg_table_name = 'order_disputes' then
    if tg_op = 'UPDATE' and old.status = new.status then return new; end if;
    if not exists (select 1 from public.order_items where order_id = new.order_id and product_type = 'digital') then return new; end if;
    v_event_type := 'dispute_transition'; v_store_id := new.store_id; v_order_id := new.order_id;
    v_dimensions := jsonb_build_object('disputeStatus', new.status);
  else
    return new;
  end if;

  insert into public.digital_product_events(store_id, order_id, product_id, event_type, dimensions)
  values (v_store_id, v_order_id, v_product_id, v_event_type, v_dimensions);
  return new;
end;
$$;

create trigger capture_digital_upload_failure
after insert or update on public.digital_asset_upload_intents
for each row execute function public.capture_digital_product_operational_event();
create trigger capture_digital_preview_failure
after insert or update on public.digital_product_previews
for each row execute function public.capture_digital_product_operational_event();
create trigger capture_digital_delivery_job_failure
after insert or update on public.digital_delivery_jobs
for each row execute function public.capture_digital_product_operational_event();
create trigger capture_digital_delivery_notification_event
after insert or update on public.digital_delivery_notifications
for each row execute function public.capture_digital_product_operational_event();
create trigger capture_digital_refund_transition
after insert or update on public.order_refunds
for each row execute function public.capture_digital_product_operational_event();
create trigger capture_digital_dispute_transition
after insert or update on public.order_disputes
for each row execute function public.capture_digital_product_operational_event();

-- The health feed exposes identifiers and bounded state only. It never returns
-- customer identity, object paths, bearer credentials, URLs, or raw errors.
create or replace function public.get_digital_delivery_health(
  p_limit integer default 100
)
returns table(
  issue_type text,
  store_id uuid,
  order_id uuid,
  job_id uuid,
  status text,
  attempt_count integer,
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
      greatest(0, floor(extract(epoch from (now() - placed_order.created_at)) / 60))::integer as age_minutes
    from public.orders placed_order
    join public.order_items item on item.order_id = placed_order.id and item.product_type = 'digital'
    left join public.digital_delivery_jobs job
      on job.order_id = placed_order.id and job.job_type = 'purchase_delivery'
    where placed_order.status = 'paid'
      and placed_order.created_at <= now() - interval '5 minutes'
      and coalesce(job.status, 'missing') <> 'succeeded'
    group by placed_order.store_id, placed_order.id, job.id, job.status,
      job.attempt_count, placed_order.created_at
  ), repeated as (
    select 'repeated_delivery_failures'::text,
      job.store_id, job.order_id, job.id, job.status,
      job.attempt_count,
      greatest(0, floor(extract(epoch from (now() - job.created_at)) / 60))::integer
    from public.digital_delivery_jobs job
    where job.status = 'failed' and job.attempt_count >= 3
  ), mismatches as (
    select 'access_state_mismatch'::text,
      issue.store_id, issue.order_id, null::uuid,
      issue.issue_type::text, 0::integer,
      greatest(0, floor(extract(epoch from (now() - placed_order.created_at)) / 60))::integer
    from public.find_digital_access_reconciliation_issues(greatest(1, least(coalesce(p_limit, 100), 500))) issue
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
begin
  if coalesce(char_length(trim(p_idempotency_key)), 0) not between 8 and 200 then
    raise exception 'Valid operation key is required';
  end if;
  v_request_hash := encode(digest(trim(p_idempotency_key), 'sha256'), 'hex');
  if exists (
    select 1 from public.digital_product_operator_actions
    where store_id = p_store_id and action = 'delivery_requeued' and request_key_hash = v_request_hash
  ) then
    return 'noop';
  end if;

  update public.digital_delivery_jobs job
  set status = 'pending', next_attempt_at = now(), lease_expires_at = null,
      lease_token = null, completed_at = null, last_safe_error = null,
      updated_at = now()
  where job.store_id = p_store_id and job.order_id = p_order_id
    and job.job_type = 'purchase_delivery' and job.status in ('pending', 'failed');
  get diagnostics v_changed = row_count;
  if v_changed = 0 then
    raise exception 'Retryable digital delivery is unavailable';
  end if;

  insert into public.digital_product_operator_actions(
    store_id, order_id, actor_user_id, action, request_key_hash, outcome
  ) values (
    p_store_id, p_order_id, p_actor_user_id, 'delivery_requeued',
    v_request_hash, 'applied'
  );
  insert into public.audit_events(store_id, actor_user_id, action, entity, entity_id, metadata)
  values (p_store_id, p_actor_user_id, 'digital_delivery_requeued', 'order', p_order_id::text, '{}'::jsonb);
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
  if coalesce(char_length(trim(p_idempotency_key)), 0) not between 8 and 200 then
    raise exception 'Valid operation key is required';
  end if;
  if not exists (
    select 1 from public.orders where id = p_order_id and store_id = p_store_id
  ) then
    raise exception 'Digital order is unavailable';
  end if;
  v_request_hash := encode(digest(trim(p_idempotency_key), 'sha256'), 'hex');
  if exists (
    select 1 from public.digital_product_operator_actions
    where store_id = p_store_id and action = 'access_reconciled' and request_key_hash = v_request_hash
  ) then
    return 'noop';
  end if;

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
  values (p_store_id, p_actor_user_id, 'digital_access_reconciled', 'order', p_order_id::text, '{}'::jsonb);
  return 'applied';
end;
$$;

revoke all on function public.requeue_digital_delivery(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.reconcile_digital_order_access(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.requeue_digital_delivery(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.reconcile_digital_order_access(uuid, uuid, uuid, text)
  to service_role;
