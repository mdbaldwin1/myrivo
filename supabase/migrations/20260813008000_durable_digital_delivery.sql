-- Make paid digital delivery a durable, leased workflow. Manifest locking and
-- job creation share the checkout transaction; workers only consume immutable
-- snapshots and never persist bearer tokens, object paths, or signed URLs.

alter table public.digital_delivery_jobs
  add column if not exists manifest_id uuid,
  add column if not exists lease_token uuid,
  add column if not exists notification_sent_at timestamptz;

-- A pre-release worker may have left an unverifiable lease behind. Requeue it;
-- a fresh token and attempt row will establish the new ownership protocol.
update public.digital_delivery_attempts
set status = 'failed',
    safe_error = 'Delivery worker upgraded while processing',
    finished_at = now()
where status = 'processing';

update public.digital_delivery_jobs
set status = 'pending',
    lease_expires_at = null,
    lease_token = null,
    completed_at = null,
    next_attempt_at = greatest(next_attempt_at, now()),
    last_safe_error = null,
    updated_at = now()
where status = 'processing';

update public.digital_delivery_jobs job
set manifest_id = manifest.id
from public.digital_purchase_manifests manifest
where manifest.order_id = job.order_id
  and manifest.store_id = job.store_id
  and manifest.status = 'locked'
  and job.manifest_id is null;

-- Legacy jobs without an immutable source cannot be processed safely. Keep
-- them visible for repair instead of falling back to the current catalog.
update public.digital_delivery_jobs
set status = 'failed',
    lease_expires_at = null,
    lease_token = null,
    completed_at = coalesce(completed_at, now()),
    last_safe_error = 'Locked purchase manifest is unavailable',
    updated_at = now()
where manifest_id is null
  and status <> 'succeeded';

alter table public.digital_delivery_jobs
  drop constraint if exists digital_delivery_jobs_lifecycle_check,
  drop constraint if exists digital_delivery_jobs_timestamps_check,
  add constraint digital_delivery_jobs_manifest_order_store_fk
    foreign key (manifest_id, order_id, store_id)
    references public.digital_purchase_manifests(id, order_id, store_id)
    on delete restrict,
  add constraint digital_delivery_jobs_purchase_manifest_check
    check (job_type <> 'purchase_delivery' or manifest_id is not null),
  add constraint digital_delivery_jobs_lifecycle_check
    check (
      (
        status = 'processing'
        and lease_expires_at is not null
        and lease_token is not null
        and completed_at is null
      )
      or (
        status = 'pending'
        and lease_expires_at is null
        and lease_token is null
        and completed_at is null
      )
      or (
        status in ('succeeded', 'failed')
        and lease_expires_at is null
        and lease_token is null
        and completed_at is not null
      )
    ),
  add constraint digital_delivery_jobs_timestamps_check
    check (
      updated_at >= created_at
      and next_attempt_at >= created_at
      and (lease_expires_at is null or lease_expires_at > updated_at)
      and (notification_sent_at is null or notification_sent_at >= created_at)
      and (completed_at is null or completed_at >= created_at)
    );

create unique index if not exists digital_delivery_jobs_manifest_type_key
  on public.digital_delivery_jobs(manifest_id, job_type)
  where manifest_id is not null;

drop index if exists public.digital_delivery_jobs_claim_idx;
create index digital_delivery_jobs_claim_idx
  on public.digital_delivery_jobs(next_attempt_at, created_at)
  where status = 'pending';

alter table public.digital_order_access_tokens
  add column if not exists delivery_job_id uuid,
  add column if not exists token_derivation_nonce uuid;

alter table public.digital_order_access_tokens
  add constraint digital_order_access_tokens_delivery_job_fk
    foreign key (delivery_job_id, order_id, store_id)
    references public.digital_delivery_jobs(id, order_id, store_id)
    on delete restrict,
  add constraint digital_order_access_tokens_delivery_derivation_pair_check
    check (
      (delivery_job_id is null and token_derivation_nonce is null)
      or (delivery_job_id is not null and token_derivation_nonce is not null)
    );

create unique index if not exists digital_order_access_tokens_active_purchase_job_key
  on public.digital_order_access_tokens(delivery_job_id)
  where issuance_reason = 'purchase'
    and delivery_job_id is not null
    and revoked_at is null;

create or replace function public.enqueue_digital_delivery(
  p_order_id uuid,
  p_manifest_id uuid
)
returns table(
  id uuid,
  store_id uuid,
  order_id uuid,
  manifest_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_manifest public.digital_purchase_manifests%rowtype;
begin
  select * into v_manifest
  from public.digital_purchase_manifests manifest
  where manifest.id = p_manifest_id
  for share;

  if not found
     or v_manifest.status <> 'locked'
     or v_manifest.order_id is distinct from p_order_id
  then
    raise exception 'Locked purchase manifest is unavailable for delivery';
  end if;
  if not exists (
    select 1 from public.orders placed_order
    where placed_order.id = p_order_id
      and placed_order.store_id = v_manifest.store_id
      and placed_order.status = 'paid'
  ) then
    raise exception 'Paid digital order is unavailable for delivery';
  end if;

  insert into public.digital_delivery_jobs(
    store_id, order_id, manifest_id, job_type, status, next_attempt_at
  ) values (
    v_manifest.store_id, p_order_id, p_manifest_id,
    'purchase_delivery', 'pending', now()
  )
  on conflict on constraint digital_delivery_jobs_order_type_key do update
  set manifest_id = excluded.manifest_id,
      updated_at = case
        when digital_delivery_jobs.manifest_id is null then now()
        else digital_delivery_jobs.updated_at
      end
  where digital_delivery_jobs.manifest_id is null
     or digital_delivery_jobs.manifest_id = excluded.manifest_id;

  return query
  select job.id, job.store_id, job.order_id, job.manifest_id, job.status
  from public.digital_delivery_jobs job
  where job.order_id = p_order_id
    and job.job_type = 'purchase_delivery'
    and job.manifest_id = p_manifest_id;

  if not found then
    raise exception 'Digital delivery job conflicts with the locked manifest';
  end if;
end;
$$;

create or replace function public.enqueue_locked_digital_manifest_delivery()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'locked'
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
  then
    perform public.enqueue_digital_delivery(new.order_id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists enqueue_locked_digital_manifest_delivery
on public.digital_purchase_manifests;
create trigger enqueue_locked_digital_manifest_delivery
after insert or update of status on public.digital_purchase_manifests
for each row execute function public.enqueue_locked_digital_manifest_delivery();

-- Backfill one job for every already-paid locked manifest. This is idempotent
-- and leaves succeeded legacy jobs untouched.
do $$
declare
  v_manifest record;
begin
  for v_manifest in
    select manifest.id, manifest.order_id
    from public.digital_purchase_manifests manifest
    join public.orders placed_order
      on placed_order.id = manifest.order_id
     and placed_order.store_id = manifest.store_id
     and placed_order.status = 'paid'
    where manifest.status = 'locked'
  loop
    perform public.enqueue_digital_delivery(v_manifest.order_id, v_manifest.id);
  end loop;
end;
$$;

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

  -- Close expired final attempts so abandoned workers become merchant-visible
  -- failures instead of remaining permanently processing.
  update public.digital_delivery_attempts attempt
  set status = 'failed', safe_error = 'Processing lease expired',
      finished_at = v_now
  from public.digital_delivery_jobs job
  where attempt.job_id = job.id
    and attempt.attempt_number = job.attempt_count
    and attempt.status = 'processing'
    and job.status = 'processing'
    and job.lease_expires_at <= v_now
    and job.attempt_count >= p_max_attempts;

  update public.digital_delivery_jobs job
  set status = 'failed', lease_expires_at = null, lease_token = null,
      last_safe_error = 'Processing lease expired', completed_at = v_now,
      updated_at = v_now
  where job.status = 'processing'
    and job.lease_expires_at <= v_now
    and job.attempt_count >= p_max_attempts;

  select job.* into v_job
  from public.digital_delivery_jobs job
  where job.job_type = 'purchase_delivery'
    and job.manifest_id is not null
    and job.attempt_count < p_max_attempts
    and (
      (job.status = 'pending' and job.next_attempt_at <= v_now)
      or (job.status = 'processing' and job.lease_expires_at <= v_now)
    )
  order by job.next_attempt_at, job.created_at, job.id
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

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

create or replace function public.materialize_digital_delivery_from_manifest(
  p_job_id uuid,
  p_lease_token uuid,
  p_token_derivation_nonce uuid,
  p_token_hash text,
  p_access_ttl_seconds integer,
  p_max_download_grants integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.digital_delivery_jobs%rowtype;
  v_manifest public.digital_purchase_manifests%rowtype;
  v_token public.digital_order_access_tokens%rowtype;
  v_manifest_count integer;
  v_entitlement_count integer;
  v_now timestamptz := clock_timestamp();
  v_customer_email text;
  v_store_name text;
begin
  if p_token_derivation_nonce is null
     or p_token_hash !~ '^[a-f0-9]{64}$'
     or p_access_ttl_seconds not between 60 and 604800
     or p_max_download_grants not between 1 and 100
  then
    raise exception 'Digital delivery materialization input is invalid';
  end if;

  select * into v_job
  from public.digital_delivery_jobs job
  where job.id = p_job_id
  for update;
  if not found
     or v_job.job_type <> 'purchase_delivery'
     or v_job.status <> 'processing'
     or v_job.lease_token is distinct from p_lease_token
     or v_job.lease_expires_at <= v_now
     or v_job.manifest_id is null
  then
    raise exception 'Digital delivery lease is unavailable';
  end if;

  select * into v_manifest
  from public.digital_purchase_manifests manifest
  where manifest.id = v_job.manifest_id
    and manifest.order_id = v_job.order_id
    and manifest.store_id = v_job.store_id
    and manifest.status = 'locked'
  for share;
  if not found then
    raise exception 'Locked purchase manifest is unavailable for delivery';
  end if;
  if not exists (
    select 1 from public.orders placed_order
    where placed_order.id = v_job.order_id
      and placed_order.store_id = v_job.store_id
      and placed_order.status = 'paid'
  ) then
    raise exception 'Paid digital order is unavailable for delivery';
  end if;

  select count(*) into v_manifest_count
  from public.digital_purchase_manifest_items item
  where item.manifest_id = v_manifest.id;
  if v_manifest_count = 0 or exists (
    select 1 from public.digital_purchase_manifest_items item
    where item.manifest_id = v_manifest.id
      and (
        item.order_id is distinct from v_job.order_id
        or item.order_item_id is null
        or item.store_id is distinct from v_job.store_id
      )
  ) then
    raise exception 'Locked purchase manifest is incomplete';
  end if;

  insert into public.digital_order_entitlements(
    store_id, order_id, order_item_id, product_id, product_variant_id,
    asset_id, asset_version_id, customer_filename, mime_type, byte_size,
    license_version, max_download_grants
  )
  select
    item.store_id, item.order_id, item.order_item_id, item.product_id,
    item.product_variant_id, item.asset_id, item.asset_version_id,
    item.customer_filename, item.mime_type, item.byte_size,
    v_manifest.license_version, p_max_download_grants
  from public.digital_purchase_manifest_items item
  where item.manifest_id = v_manifest.id
  order by item.sort_order, item.id
  on conflict (order_item_id, asset_version_id) do nothing;

  select count(*) into v_entitlement_count
  from public.digital_order_entitlements entitlement
  where entitlement.order_id = v_job.order_id;

  if v_entitlement_count <> v_manifest_count
     or exists (
       select 1
       from public.digital_order_entitlements entitlement
       where entitlement.order_id = v_job.order_id
         and not exists (
           select 1
           from public.digital_purchase_manifest_items item
           where item.manifest_id = v_manifest.id
             and item.order_id = entitlement.order_id
             and item.order_item_id = entitlement.order_item_id
             and item.product_id = entitlement.product_id
             and item.product_variant_id is not distinct from entitlement.product_variant_id
             and item.asset_id = entitlement.asset_id
             and item.asset_version_id = entitlement.asset_version_id
             and item.customer_filename = entitlement.customer_filename
             and item.mime_type = entitlement.mime_type
             and item.byte_size = entitlement.byte_size
             and v_manifest.license_version = entitlement.license_version
         )
     )
  then
    raise exception 'Digital entitlement state does not match the locked manifest';
  end if;

  select * into v_token
  from public.digital_order_access_tokens token
  where token.delivery_job_id = v_job.id
    and token.issuance_reason = 'purchase'
    and token.revoked_at is null
  for update;

  if not found then
    insert into public.digital_order_access_tokens(
      store_id, order_id, delivery_job_id, token_derivation_nonce,
      token_hash, issuance_reason, expires_at, created_at
    ) values (
      v_job.store_id, v_job.order_id, v_job.id,
      p_token_derivation_nonce, p_token_hash, 'purchase',
      v_now + make_interval(secs => p_access_ttl_seconds), v_now
    ) returning * into v_token;
  elsif v_token.token_derivation_nonce is null then
    raise exception 'Digital delivery token cannot be reproduced';
  end if;

  select placed_order.customer_email, store.name
  into v_customer_email, v_store_name
  from public.orders placed_order
  join public.stores store on store.id = placed_order.store_id
  where placed_order.id = v_job.order_id
    and placed_order.store_id = v_job.store_id;

  return jsonb_build_object(
    'entitlement_count', v_entitlement_count,
    'access_token_id', v_token.id,
    'token_derivation_nonce', v_token.token_derivation_nonce,
    'token_hash', v_token.token_hash,
    'expires_at', v_token.expires_at,
    'customer_email', v_customer_email,
    'store_name', v_store_name
  );
end;
$$;

create or replace function public.mark_digital_delivery_notification_sent(
  p_job_id uuid,
  p_lease_token uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.digital_delivery_jobs job
  set notification_sent_at = coalesce(job.notification_sent_at, clock_timestamp()),
      updated_at = clock_timestamp()
  where job.id = p_job_id
    and job.status = 'processing'
    and job.lease_token = p_lease_token
    and job.lease_expires_at > clock_timestamp();
  if not found then
    raise exception 'Digital delivery lease is unavailable';
  end if;
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

  if v_job.attempt_count >= p_max_attempts then
    update public.digital_delivery_jobs
    set status = 'failed', lease_expires_at = null, lease_token = null,
        last_safe_error = v_safe_error, completed_at = v_now, updated_at = v_now
    where id = v_job.id;
    return jsonb_build_object('status', 'failed', 'next_attempt_at', null);
  end if;

  v_retry_seconds := least(
    p_retry_max_seconds::numeric,
    p_retry_base_seconds::numeric * power(2::numeric, v_job.attempt_count - 1)
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

revoke all on function public.enqueue_locked_digital_manifest_delivery()
from public, anon, authenticated;
revoke all on function public.enqueue_digital_delivery(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.claim_digital_delivery_job(integer, integer)
from public, anon, authenticated;
revoke all on function public.materialize_digital_delivery_from_manifest(
  uuid, uuid, uuid, text, integer, integer
) from public, anon, authenticated;
revoke all on function public.mark_digital_delivery_notification_sent(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.complete_digital_delivery_job(
  uuid, uuid, text, text, integer, integer, integer
) from public, anon, authenticated;

grant execute on function public.enqueue_digital_delivery(uuid, uuid)
to service_role;
grant execute on function public.claim_digital_delivery_job(integer, integer)
to service_role;
grant execute on function public.materialize_digital_delivery_from_manifest(
  uuid, uuid, uuid, text, integer, integer
) to service_role;
grant execute on function public.mark_digital_delivery_notification_sent(uuid, uuid)
to service_role;
grant execute on function public.complete_digital_delivery_job(
  uuid, uuid, text, text, integer, integer, integer
) to service_role;
