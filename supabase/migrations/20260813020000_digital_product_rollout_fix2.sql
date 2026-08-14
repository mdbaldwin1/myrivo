-- Task 14 rollout operations review follow-up 2:
-- make every telemetry dimension type explicit and keep repair telemetry on
-- the bounded per-generation retry budget instead of unbounded job history.

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
  v_key_count integer;
begin
  if jsonb_typeof(p_dimensions) is distinct from 'object' then
    return false;
  end if;

  select count(*)::integer into v_key_count
  from jsonb_object_keys(p_dimensions);

  if p_event_type = 'upload_failed' then
    if v_key_count <> 2
       or not (p_dimensions ?& array['stage', 'outcome'])
       or jsonb_typeof(p_dimensions -> 'stage') is distinct from 'string'
       or p_dimensions ->> 'stage' is null
       or jsonb_typeof(p_dimensions -> 'outcome') is distinct from 'string'
       or p_dimensions ->> 'outcome' is null
    then return false; end if;
    return p_dimensions ->> 'stage' in ('upload', 'completion')
      and p_dimensions ->> 'outcome' = 'failed';
  elsif p_event_type = 'preview_failed' then
    if v_key_count <> 2
       or not (p_dimensions ?& array['stage', 'outcome'])
       or jsonb_typeof(p_dimensions -> 'stage') is distinct from 'string'
       or p_dimensions ->> 'stage' is null
       or jsonb_typeof(p_dimensions -> 'outcome') is distinct from 'string'
       or p_dimensions ->> 'outcome' is null
    then return false; end if;
    return p_dimensions ->> 'stage' in ('preview', 'completion')
      and p_dimensions ->> 'outcome' = 'failed';
  elsif p_event_type = 'manifest_failed' then
    if v_key_count <> 3
       or not (p_dimensions ?& array['stage', 'outcome', 'composition'])
       or jsonb_typeof(p_dimensions -> 'stage') is distinct from 'string'
       or p_dimensions ->> 'stage' is null
       or jsonb_typeof(p_dimensions -> 'outcome') is distinct from 'string'
       or p_dimensions ->> 'outcome' is null
       or jsonb_typeof(p_dimensions -> 'composition') is distinct from 'string'
       or p_dimensions ->> 'composition' is null
    then return false; end if;
    return p_dimensions ->> 'stage' = 'checkout_manifest'
      and p_dimensions ->> 'outcome' = 'failed'
      and p_dimensions ->> 'composition' in ('digital_only', 'mixed');
  elsif p_event_type = 'delivery_job_aged' then
    if v_key_count <> 1
       or not (p_dimensions ? 'ageBucket')
       or jsonb_typeof(p_dimensions -> 'ageBucket') is distinct from 'string'
       or p_dimensions ->> 'ageBucket' is null
    then return false; end if;
    return p_dimensions ->> 'ageBucket' in ('5m_to_30m', '30m_plus');
  elsif p_event_type = 'delivery_job_failed' then
    if v_key_count <> 2
       or not (p_dimensions ?& array['outcome', 'attemptNumber'])
       or jsonb_typeof(p_dimensions -> 'outcome') is distinct from 'string'
       or p_dimensions ->> 'outcome' is null
       or jsonb_typeof(p_dimensions -> 'attemptNumber') is distinct from 'number'
       or p_dimensions ->> 'attemptNumber' is null
    then return false; end if;
    v_attempt := (p_dimensions ->> 'attemptNumber')::numeric;
    return p_dimensions ->> 'outcome' = 'failed'
      and v_attempt = trunc(v_attempt)
      and v_attempt between 0 and 10000;
  elsif p_event_type = 'delivery_email_attempted' then
    if v_key_count <> 3
       or not (p_dimensions ?& array['notificationType', 'outcome', 'attemptNumber'])
       or jsonb_typeof(p_dimensions -> 'notificationType') is distinct from 'string'
       or p_dimensions ->> 'notificationType' is null
       or jsonb_typeof(p_dimensions -> 'outcome') is distinct from 'string'
       or p_dimensions ->> 'outcome' is null
       or jsonb_typeof(p_dimensions -> 'attemptNumber') is distinct from 'number'
       or p_dimensions ->> 'attemptNumber' is null
    then return false; end if;
    v_attempt := (p_dimensions ->> 'attemptNumber')::numeric;
    return p_dimensions ->> 'notificationType' in (
        'purchase', 'merchant_resend', 'customer_recovery', 'refund', 'dispute'
      )
      and p_dimensions ->> 'outcome' in (
        'queued', 'pending', 'processing', 'succeeded', 'failed', 'denied'
      )
      and v_attempt = trunc(v_attempt)
      and v_attempt between 0 and 10000;
  elsif p_event_type = 'access_link_regenerated' then
    if v_key_count <> 2
       or not (p_dimensions ?& array['notificationType', 'outcome'])
       or jsonb_typeof(p_dimensions -> 'notificationType') is distinct from 'string'
       or p_dimensions ->> 'notificationType' is null
       or jsonb_typeof(p_dimensions -> 'outcome') is distinct from 'string'
       or p_dimensions ->> 'outcome' is null
    then return false; end if;
    return p_dimensions ->> 'notificationType' in (
        'merchant_resend', 'customer_recovery'
      )
      and p_dimensions ->> 'outcome' = 'queued';
  elsif p_event_type = 'download_signing_failed' then
    if v_key_count <> 2
       or not (p_dimensions ?& array['stage', 'outcome'])
       or jsonb_typeof(p_dimensions -> 'stage') is distinct from 'string'
       or p_dimensions ->> 'stage' is null
       or jsonb_typeof(p_dimensions -> 'outcome') is distinct from 'string'
       or p_dimensions ->> 'outcome' is null
    then return false; end if;
    return p_dimensions ->> 'stage' = 'storage_signing'
      and p_dimensions ->> 'outcome' = 'failed';
  elsif p_event_type = 'grant_exhausted' then
    if v_key_count <> 2
       or not (p_dimensions ?& array['stage', 'outcome'])
       or jsonb_typeof(p_dimensions -> 'stage') is distinct from 'string'
       or p_dimensions ->> 'stage' is null
       or jsonb_typeof(p_dimensions -> 'outcome') is distinct from 'string'
       or p_dimensions ->> 'outcome' is null
    then return false; end if;
    return p_dimensions ->> 'stage' = 'reservation'
      and p_dimensions ->> 'outcome' = 'denied';
  elsif p_event_type = 'reconciliation_mismatch' then
    if v_key_count <> 1
       or not (p_dimensions ? 'issueType')
       or jsonb_typeof(p_dimensions -> 'issueType') is distinct from 'string'
       or p_dimensions ->> 'issueType' is null
    then return false; end if;
    return p_dimensions ->> 'issueType' in (
      'paid_order_missing_entitlements', 'full_refund_active_access',
      'open_dispute_access_mismatch', 'lost_dispute_access_mismatch',
      'token_access_mismatch'
    );
  elsif p_event_type = 'refund_transition' then
    if v_key_count <> 1
       or not (p_dimensions ? 'outcome')
       or jsonb_typeof(p_dimensions -> 'outcome') is distinct from 'string'
       or p_dimensions ->> 'outcome' is null
    then return false; end if;
    return p_dimensions ->> 'outcome' in (
      'requested', 'processing', 'succeeded', 'failed', 'cancelled'
    );
  elsif p_event_type = 'dispute_transition' then
    if v_key_count <> 1
       or not (p_dimensions ? 'disputeStatus')
       or jsonb_typeof(p_dimensions -> 'disputeStatus') is distinct from 'string'
       or p_dimensions ->> 'disputeStatus' is null
    then return false; end if;
    return p_dimensions ->> 'disputeStatus' in (
      'warning_needs_response', 'warning_under_review', 'warning_closed',
      'needs_response', 'under_review', 'won', 'lost', 'prevented'
    );
  end if;

  return false;
end;
$$;

-- Revalidate the table after replacing a function referenced by the check.
alter table public.digital_product_events
  drop constraint digital_product_events_dimensions_check;
delete from public.digital_product_events event
where not public.digital_product_event_dimensions_are_safe(
  event.event_type,
  event.dimensions
);
alter table public.digital_product_events
  add constraint digital_product_events_dimensions_check
  check (public.digital_product_event_dimensions_are_safe(event_type, dimensions));

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
    v_dimensions := jsonb_build_object(
      'outcome', 'failed',
      'attemptNumber', new.generation_attempt_count
    );
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
