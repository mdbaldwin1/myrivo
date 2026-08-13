-- Financial provider events and digital access must converge in one transaction.

alter table public.order_refunds
  add column if not exists source_event_id text,
  add column if not exists source_event_created_at timestamptz;

alter table public.order_disputes
  add column if not exists source_event_id text,
  add column if not exists source_event_created_at timestamptz;

create unique index if not exists order_refunds_stripe_refund_id_key
  on public.order_refunds(stripe_refund_id)
  where stripe_refund_id is not null;

alter table public.digital_order_entitlements
  add column if not exists status_source_dispute_id uuid;

alter table public.digital_order_entitlements
  drop constraint if exists digital_order_entitlements_status_source_dispute_fk,
  add constraint digital_order_entitlements_status_source_dispute_fk
    foreign key (status_source_dispute_id)
    references public.order_disputes(id)
    on delete restrict;

create table if not exists public.financial_access_event_idempotency (
  source_event_id text primary key check (char_length(trim(source_event_id)) between 1 and 255),
  transition_kind text not null check (transition_kind in ('refund', 'dispute')),
  source_event_created_at timestamptz not null,
  order_id uuid not null references public.orders(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists financial_access_event_idempotency_order_idx
  on public.financial_access_event_idempotency(order_id, created_at desc);

alter table public.financial_access_event_idempotency enable row level security;

-- Normalize access rows produced by the prototype before enforcing source-aware transitions.
update public.digital_order_entitlements
set status_reason = 'dispute_open'
where status = 'suspended'
  and status_reason = 'open_dispute';

update public.digital_order_entitlements entitlement
set status = 'revoked',
    status_reason = 'full_refund',
    status_source_dispute_id = null
where exists (
  select 1
  from public.orders placed_order
  where placed_order.id = entitlement.order_id
    and exists (
      select 1 from public.order_refunds refund
      where refund.order_id = placed_order.id and refund.status = 'succeeded'
    )
    and (
      select coalesce(sum(refund.amount_cents), 0)
      from public.order_refunds refund
      where refund.order_id = placed_order.id and refund.status = 'succeeded'
    ) >= greatest(placed_order.total_cents, 1)
);

update public.digital_order_entitlements entitlement
set status = 'revoked',
    status_reason = 'dispute_lost',
    status_source_dispute_id = (
      select dispute.id
      from public.order_disputes dispute
      where dispute.order_id = entitlement.order_id and dispute.status = 'lost'
      order by dispute.source_event_created_at desc nulls last,
               dispute.updated_at desc,
               dispute.id desc
      limit 1
    )
where status_reason is distinct from 'full_refund'
  and exists (
    select 1 from public.order_disputes dispute
    where dispute.order_id = entitlement.order_id and dispute.status = 'lost'
  );

update public.digital_order_entitlements entitlement
set status = 'suspended',
    status_reason = 'dispute_open',
    status_source_dispute_id = (
      select dispute.id
      from public.order_disputes dispute
      where dispute.order_id = entitlement.order_id
        and dispute.status in (
          'warning_needs_response', 'warning_under_review',
          'needs_response', 'under_review'
        )
      order by dispute.source_event_created_at asc nulls last,
               dispute.created_at asc,
               dispute.id asc
      limit 1
    )
where status_reason is distinct from 'full_refund'
  and status_reason is distinct from 'dispute_lost'
  and exists (
    select 1 from public.order_disputes dispute
    where dispute.order_id = entitlement.order_id
      and dispute.status in (
        'warning_needs_response', 'warning_under_review',
        'needs_response', 'under_review'
      )
  );

update public.digital_order_entitlements entitlement
set status = 'active', status_reason = null, status_source_dispute_id = null
where entitlement.status = 'suspended'
  and entitlement.status_reason = 'dispute_open'
  and not exists (
    select 1 from public.order_disputes dispute
    where dispute.order_id = entitlement.order_id
      and dispute.status in (
        'warning_needs_response', 'warning_under_review',
        'needs_response', 'under_review'
      )
  );

update public.digital_order_entitlements
set status_reason = null, status_source_dispute_id = null
where status_reason = 'dispute_lost'
  and status_source_dispute_id is null;

update public.digital_order_entitlements
set status_source_dispute_id = null
where status_reason is distinct from 'dispute_open'
  and status_reason is distinct from 'dispute_lost';

alter table public.digital_order_entitlements
  drop constraint if exists digital_order_entitlements_financial_reason_check,
  add constraint digital_order_entitlements_financial_reason_check check (
    (status_reason is distinct from 'full_refund'
      or (status = 'revoked' and status_source_dispute_id is null))
    and
    (status_reason is distinct from 'dispute_open'
      or status = 'suspended')
    and
    (status_reason is distinct from 'dispute_lost'
      or (status = 'revoked' and status_source_dispute_id is not null))
    and
    (status_source_dispute_id is null
      or status_reason in ('dispute_open', 'dispute_lost'))
  );

create or replace function public.apply_digital_financial_access_state(
  p_order_id uuid,
  p_transition_dispute_id uuid default null
)
returns table(effective_access_state text, access_changed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_has_entitlements boolean;
  v_full_refund boolean;
  v_lost_dispute_id uuid;
  v_open_dispute_id uuid;
  v_changed integer := 0;
  v_step_changed integer := 0;
begin
  select * into v_order
  from public.orders placed_order
  where placed_order.id = p_order_id
  for update;
  if not found then
    raise exception 'Digital access order is unavailable';
  end if;

  select exists (
    select 1 from public.digital_order_entitlements entitlement
    where entitlement.order_id = p_order_id
  ) into v_has_entitlements;

  select exists (
    select 1 from public.order_refunds refund
    where refund.order_id = p_order_id and refund.status = 'succeeded'
  ) and coalesce((
    select sum(refund.amount_cents)
    from public.order_refunds refund
    where refund.order_id = p_order_id and refund.status = 'succeeded'
  ), 0) >= greatest(v_order.total_cents, 1)
  into v_full_refund;

  select dispute.id into v_lost_dispute_id
  from public.order_disputes dispute
  where dispute.order_id = p_order_id and dispute.status = 'lost'
  order by dispute.source_event_created_at desc nulls last,
           dispute.updated_at desc,
           dispute.id desc
  limit 1;

  select dispute.id into v_open_dispute_id
  from public.order_disputes dispute
  where dispute.order_id = p_order_id
    and dispute.status in (
      'warning_needs_response', 'warning_under_review',
      'needs_response', 'under_review'
    )
  order by dispute.source_event_created_at asc nulls last,
           dispute.created_at asc,
           dispute.id asc
  limit 1;

  if not v_has_entitlements then
    return query select 'not_applicable'::text, false;
    return;
  end if;

  if v_full_refund then
    update public.digital_order_entitlements entitlement
    set status = 'revoked', status_reason = 'full_refund',
        status_source_dispute_id = null, updated_at = clock_timestamp()
    where entitlement.order_id = p_order_id
      and (
        entitlement.status <> 'revoked'
        or entitlement.status_reason is distinct from 'full_refund'
        or entitlement.status_source_dispute_id is not null
      );
    get diagnostics v_changed = row_count;

    update public.digital_order_access_tokens token
    set revoked_at = clock_timestamp()
    where token.order_id = p_order_id and token.revoked_at is null;
    get diagnostics v_step_changed = row_count;
    v_changed := v_changed + v_step_changed;
    return query select 'revoked'::text, v_changed > 0;
    return;
  end if;

  if v_lost_dispute_id is not null then
    update public.digital_order_entitlements entitlement
    set status = 'revoked', status_reason = 'dispute_lost',
        status_source_dispute_id = v_lost_dispute_id,
        updated_at = clock_timestamp()
    where entitlement.order_id = p_order_id
      and (
        entitlement.status <> 'revoked'
        or entitlement.status_reason is distinct from 'dispute_lost'
        or entitlement.status_source_dispute_id is distinct from v_lost_dispute_id
      );
    get diagnostics v_changed = row_count;

    update public.digital_order_access_tokens token
    set revoked_at = clock_timestamp()
    where token.order_id = p_order_id and token.revoked_at is null;
    get diagnostics v_step_changed = row_count;
    v_changed := v_changed + v_step_changed;
    return query select 'revoked'::text, v_changed > 0;
    return;
  end if;

  if v_open_dispute_id is not null then
    update public.digital_order_entitlements entitlement
    set status = 'suspended', status_reason = 'dispute_open',
        status_source_dispute_id = v_open_dispute_id,
        updated_at = clock_timestamp()
    where entitlement.order_id = p_order_id
      and (
        entitlement.status = 'active'
        or (
          entitlement.status = 'suspended'
          and entitlement.status_reason = 'dispute_open'
          and not exists (
            select 1 from public.order_disputes source_dispute
            where source_dispute.id = entitlement.status_source_dispute_id
              and source_dispute.order_id = p_order_id
              and source_dispute.status in (
                'warning_needs_response', 'warning_under_review',
                'needs_response', 'under_review'
              )
          )
        )
      );
    get diagnostics v_changed = row_count;
    return query select 'suspended'::text, v_changed > 0;
    return;
  end if;

  if p_transition_dispute_id is not null then
    update public.digital_order_entitlements entitlement
    set status = 'active', status_reason = null,
        status_source_dispute_id = null, updated_at = clock_timestamp()
    where entitlement.order_id = p_order_id
      and entitlement.status = 'suspended'
      and entitlement.status_reason = 'dispute_open'
      and entitlement.status_source_dispute_id = p_transition_dispute_id;
    get diagnostics v_changed = row_count;
  end if;

  return query select 'active'::text, v_changed > 0;
end;
$$;

create or replace function public.enforce_digital_entitlement_financial_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total_cents integer;
  v_lost_dispute_id uuid;
  v_open_dispute_id uuid;
begin
  select placed_order.total_cents into v_total_cents
  from public.orders placed_order
  where placed_order.id = new.order_id
  for update;
  if not found then return new; end if;

  if exists (
    select 1 from public.order_refunds refund
    where refund.order_id = new.order_id and refund.status = 'succeeded'
  ) and coalesce((
    select sum(refund.amount_cents) from public.order_refunds refund
    where refund.order_id = new.order_id and refund.status = 'succeeded'
  ), 0) >= greatest(v_total_cents, 1) then
    new.status := 'revoked';
    new.status_reason := 'full_refund';
    new.status_source_dispute_id := null;
    return new;
  end if;

  select dispute.id into v_lost_dispute_id
  from public.order_disputes dispute
  where dispute.order_id = new.order_id and dispute.status = 'lost'
  order by dispute.source_event_created_at desc nulls last,
           dispute.updated_at desc,
           dispute.id desc
  limit 1;
  if v_lost_dispute_id is not null then
    new.status := 'revoked';
    new.status_reason := 'dispute_lost';
    new.status_source_dispute_id := v_lost_dispute_id;
    return new;
  end if;

  select dispute.id into v_open_dispute_id
  from public.order_disputes dispute
  where dispute.order_id = new.order_id
    and dispute.status in (
      'warning_needs_response', 'warning_under_review',
      'needs_response', 'under_review'
    )
  order by dispute.source_event_created_at asc nulls last,
           dispute.created_at asc,
           dispute.id asc
  limit 1;
  if v_open_dispute_id is not null then
    new.status := 'suspended';
    new.status_reason := 'dispute_open';
    new.status_source_dispute_id := v_open_dispute_id;
  end if;
  return new;
end;
$$;

drop trigger if exists digital_entitlements_enforce_financial_state
  on public.digital_order_entitlements;
create trigger digital_entitlements_enforce_financial_state
before insert or update of order_id, status, status_reason, status_source_dispute_id
on public.digital_order_entitlements
for each row execute function public.enforce_digital_entitlement_financial_state();

create or replace function public.enforce_digital_access_token_financial_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total_cents integer;
begin
  select placed_order.total_cents into v_total_cents
  from public.orders placed_order
  where placed_order.id = new.order_id
  for update;
  if not found then return new; end if;

  if (
    exists (
      select 1 from public.order_refunds refund
      where refund.order_id = new.order_id and refund.status = 'succeeded'
    ) and coalesce((
      select sum(refund.amount_cents) from public.order_refunds refund
      where refund.order_id = new.order_id and refund.status = 'succeeded'
    ), 0) >= greatest(v_total_cents, 1)
  ) or exists (
    select 1 from public.order_disputes dispute
    where dispute.order_id = new.order_id and dispute.status = 'lost'
  ) then
    new.revoked_at := coalesce(new.revoked_at, clock_timestamp());
  end if;
  return new;
end;
$$;

drop trigger if exists digital_access_tokens_enforce_financial_state
  on public.digital_order_access_tokens;
create trigger digital_access_tokens_enforce_financial_state
before insert or update of order_id, revoked_at
on public.digital_order_access_tokens
for each row execute function public.enforce_digital_access_token_financial_state();

create or replace function public.sync_refund_digital_access(
  p_refund_request_id uuid,
  p_stripe_refund_id text,
  p_incoming_status text,
  p_stripe_status text,
  p_stripe_failure_reason text,
  p_pending_reason text,
  p_processed_by_user_id uuid,
  p_source_event_id text,
  p_source_event_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund public.order_refunds%rowtype;
  v_previous_status text;
  v_effective_access_state text;
  v_access_changed boolean := false;
  v_state_changed boolean := false;
  v_existing_kind text;
  v_is_stale boolean := false;
begin
  if nullif(trim(p_stripe_refund_id), '') is null
     or p_incoming_status not in ('requested', 'processing', 'succeeded', 'failed', 'cancelled')
     or nullif(trim(p_source_event_id), '') is null
     or p_source_event_created_at is null
  then
    raise exception 'Refund access synchronization input is invalid';
  end if;

  if p_refund_request_id is not null then
    select * into v_refund from public.order_refunds refund
    where refund.id = p_refund_request_id for update;
  end if;
  if not found then
    select * into v_refund from public.order_refunds refund
    where refund.stripe_refund_id = p_stripe_refund_id for update;
  end if;
  if not found then
    return jsonb_build_object(
      'applied', false, 'state_changed', false, 'access_changed', false,
      'effective_access_state', 'not_applicable', 'record', null
    );
  end if;
  if v_refund.stripe_refund_id is not null
     and v_refund.stripe_refund_id <> p_stripe_refund_id then
    raise exception 'Refund provider identity does not match';
  end if;

  perform 1 from public.orders placed_order
  where placed_order.id = v_refund.order_id and placed_order.store_id = v_refund.store_id
  for update;
  if not found then raise exception 'Refund order is unavailable'; end if;

  select event.transition_kind into v_existing_kind
  from public.financial_access_event_idempotency event
  where event.source_event_id = p_source_event_id;
  if found then
    if v_existing_kind <> 'refund' then
      raise exception 'Financial event identity is already bound';
    end if;
    return jsonb_build_object(
      'applied', false, 'state_changed', false, 'access_changed', false,
      'effective_access_state', case
        when exists (select 1 from public.digital_order_entitlements e where e.order_id = v_refund.order_id and e.status = 'revoked') then 'revoked'
        when exists (select 1 from public.digital_order_entitlements e where e.order_id = v_refund.order_id and e.status = 'suspended') then 'suspended'
        when exists (select 1 from public.digital_order_entitlements e where e.order_id = v_refund.order_id) then 'active'
        else 'not_applicable' end,
      'record', to_jsonb(v_refund)
    );
  end if;

  insert into public.financial_access_event_idempotency(
    source_event_id, transition_kind, source_event_created_at, order_id, store_id
  ) values (
    p_source_event_id, 'refund', p_source_event_created_at,
    v_refund.order_id, v_refund.store_id
  );

  v_is_stale := v_refund.source_event_created_at is not null
    and (
      p_source_event_created_at < v_refund.source_event_created_at
      or (
        v_refund.status in ('succeeded', 'failed', 'cancelled')
        and p_incoming_status is distinct from v_refund.status
      )
    );
  if v_is_stale then
    return jsonb_build_object(
      'applied', false, 'state_changed', false, 'access_changed', false,
      'effective_access_state', case
        when exists (select 1 from public.digital_order_entitlements e where e.order_id = v_refund.order_id and e.status = 'revoked') then 'revoked'
        when exists (select 1 from public.digital_order_entitlements e where e.order_id = v_refund.order_id and e.status = 'suspended') then 'suspended'
        when exists (select 1 from public.digital_order_entitlements e where e.order_id = v_refund.order_id) then 'active'
        else 'not_applicable' end,
      'record', to_jsonb(v_refund)
    );
  end if;

  v_previous_status := v_refund.status;
  update public.order_refunds refund
  set status = p_incoming_status,
      stripe_refund_id = p_stripe_refund_id,
      processed_by_user_id = coalesce(p_processed_by_user_id, refund.processed_by_user_id),
      processed_at = case
        when p_incoming_status in ('succeeded', 'failed', 'cancelled')
          then coalesce(refund.processed_at, p_source_event_created_at)
        else refund.processed_at end,
      metadata_json = coalesce(refund.metadata_json, '{}'::jsonb) || jsonb_build_object(
        'stripeStatus', p_stripe_status,
        'stripeFailureReason', p_stripe_failure_reason,
        'pendingReason', p_pending_reason
      ) || case when p_stripe_refund_id like 'stub_refund_%'
        then jsonb_build_object('processedMode', 'stub')
        else '{}'::jsonb end,
      source_event_id = p_source_event_id,
      source_event_created_at = p_source_event_created_at,
      updated_at = clock_timestamp()
  where refund.id = v_refund.id
  returning * into v_refund;
  v_state_changed := v_previous_status is distinct from v_refund.status;

  select state.effective_access_state, state.access_changed
  into v_effective_access_state, v_access_changed
  from public.apply_digital_financial_access_state(v_refund.order_id, null) state;

  if v_state_changed or v_access_changed then
    insert into public.audit_events(store_id, action, entity, entity_id, metadata)
    values (
      v_refund.store_id,
      case v_refund.status
        when 'succeeded' then 'refund_succeeded'
        when 'failed' then 'refund_failed'
        when 'cancelled' then 'refund_cancelled'
        else 'refund_processing' end,
      'order', v_refund.order_id::text,
      jsonb_build_object(
        'refundId', v_refund.id,
        'stripeRefundId', v_refund.stripe_refund_id,
        'amountCents', v_refund.amount_cents,
        'status', v_refund.status,
        'sourceEventId', p_source_event_id,
        'effectiveAccessState', v_effective_access_state,
        'accessChanged', v_access_changed
      )
    );
  end if;

  return jsonb_build_object(
    'applied', true, 'state_changed', v_state_changed,
    'access_changed', v_access_changed,
    'effective_access_state', v_effective_access_state,
    'record', to_jsonb(v_refund)
  );
end;
$$;

create or replace function public.sync_dispute_digital_access(
  p_order_id uuid,
  p_store_id uuid,
  p_stripe_dispute_id text,
  p_stripe_charge_id text,
  p_stripe_payment_intent_id text,
  p_amount_cents integer,
  p_currency text,
  p_reason text,
  p_incoming_status text,
  p_is_charge_refundable boolean,
  p_response_due_by timestamptz,
  p_metadata_json jsonb,
  p_source_event_id text,
  p_source_event_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dispute public.order_disputes%rowtype;
  v_previous_status text;
  v_had_dispute boolean := false;
  v_effective_access_state text;
  v_access_changed boolean := false;
  v_state_changed boolean := false;
  v_existing_kind text;
  v_is_stale boolean := false;
begin
  if nullif(trim(p_stripe_dispute_id), '') is null
     or nullif(trim(p_stripe_payment_intent_id), '') is null
     or p_amount_cents <= 0
     or nullif(trim(p_currency), '') is null
     or nullif(trim(p_reason), '') is null
     or p_incoming_status not in (
       'warning_needs_response', 'warning_under_review', 'warning_closed',
       'needs_response', 'under_review', 'won', 'lost', 'prevented'
     )
     or nullif(trim(p_source_event_id), '') is null
     or p_source_event_created_at is null
  then
    raise exception 'Dispute access synchronization input is invalid';
  end if;

  perform 1 from public.orders placed_order
  where placed_order.id = p_order_id
    and placed_order.store_id = p_store_id
    and placed_order.stripe_payment_intent_id = p_stripe_payment_intent_id
  for update;
  if not found then raise exception 'Dispute order is unavailable'; end if;

  select * into v_dispute from public.order_disputes dispute
  where dispute.stripe_dispute_id = p_stripe_dispute_id
  for update;
  v_had_dispute := found;
  if v_had_dispute
     and (v_dispute.order_id <> p_order_id or v_dispute.store_id <> p_store_id) then
    raise exception 'Dispute provider identity does not match';
  end if;

  select event.transition_kind into v_existing_kind
  from public.financial_access_event_idempotency event
  where event.source_event_id = p_source_event_id;
  if found then
    if v_existing_kind <> 'dispute' then
      raise exception 'Financial event identity is already bound';
    end if;
    return jsonb_build_object(
      'applied', false, 'state_changed', false, 'access_changed', false,
      'effective_access_state', case
        when exists (select 1 from public.digital_order_entitlements e where e.order_id = p_order_id and e.status = 'revoked') then 'revoked'
        when exists (select 1 from public.digital_order_entitlements e where e.order_id = p_order_id and e.status = 'suspended') then 'suspended'
        when exists (select 1 from public.digital_order_entitlements e where e.order_id = p_order_id) then 'active'
        else 'not_applicable' end,
      'record', case when v_had_dispute then to_jsonb(v_dispute) else null end
    );
  end if;

  insert into public.financial_access_event_idempotency(
    source_event_id, transition_kind, source_event_created_at, order_id, store_id
  ) values (
    p_source_event_id, 'dispute', p_source_event_created_at, p_order_id, p_store_id
  );

  v_is_stale := v_had_dispute and (
    (v_dispute.source_event_created_at is not null
      and p_source_event_created_at < v_dispute.source_event_created_at)
    or (
      v_dispute.status in ('warning_closed', 'won', 'lost', 'prevented')
      and p_incoming_status is distinct from v_dispute.status
    )
  );
  if v_is_stale then
    return jsonb_build_object(
      'applied', false, 'state_changed', false, 'access_changed', false,
      'effective_access_state', case
        when exists (select 1 from public.digital_order_entitlements e where e.order_id = p_order_id and e.status = 'revoked') then 'revoked'
        when exists (select 1 from public.digital_order_entitlements e where e.order_id = p_order_id and e.status = 'suspended') then 'suspended'
        when exists (select 1 from public.digital_order_entitlements e where e.order_id = p_order_id) then 'active'
        else 'not_applicable' end,
      'record', to_jsonb(v_dispute)
    );
  end if;

  v_previous_status := case when v_had_dispute then v_dispute.status else null end;
  insert into public.order_disputes(
    order_id, store_id, stripe_dispute_id, stripe_charge_id,
    stripe_payment_intent_id, amount_cents, currency, reason, status,
    is_charge_refundable, response_due_by, metadata_json, closed_at,
    source_event_id, source_event_created_at
  ) values (
    p_order_id, p_store_id, p_stripe_dispute_id, p_stripe_charge_id,
    p_stripe_payment_intent_id, p_amount_cents, lower(trim(p_currency)),
    p_reason, p_incoming_status, p_is_charge_refundable, p_response_due_by,
    coalesce(p_metadata_json, '{}'::jsonb),
    case when p_incoming_status in ('warning_closed', 'won', 'lost', 'prevented')
      then p_source_event_created_at else null end,
    p_source_event_id, p_source_event_created_at
  )
  on conflict (stripe_dispute_id) do update set
    stripe_charge_id = excluded.stripe_charge_id,
    stripe_payment_intent_id = excluded.stripe_payment_intent_id,
    amount_cents = excluded.amount_cents,
    currency = excluded.currency,
    reason = excluded.reason,
    status = excluded.status,
    is_charge_refundable = excluded.is_charge_refundable,
    response_due_by = excluded.response_due_by,
    metadata_json = excluded.metadata_json,
    closed_at = case
      when excluded.status in ('warning_closed', 'won', 'lost', 'prevented')
        then coalesce(public.order_disputes.closed_at, excluded.closed_at)
      else null end,
    source_event_id = excluded.source_event_id,
    source_event_created_at = excluded.source_event_created_at,
    updated_at = clock_timestamp()
  returning * into v_dispute;
  v_state_changed := not v_had_dispute
    or v_previous_status is distinct from v_dispute.status;

  select state.effective_access_state, state.access_changed
  into v_effective_access_state, v_access_changed
  from public.apply_digital_financial_access_state(p_order_id, v_dispute.id) state;

  if v_state_changed or v_access_changed then
    insert into public.audit_events(store_id, action, entity, entity_id, metadata)
    values (
      p_store_id,
      case
        when v_dispute.status in ('warning_closed', 'won', 'lost', 'prevented')
          then 'dispute_closed'
        when not v_had_dispute then 'dispute_opened'
        else 'dispute_updated' end,
      'order', p_order_id::text,
      jsonb_build_object(
        'disputeId', v_dispute.id,
        'stripeDisputeId', v_dispute.stripe_dispute_id,
        'previousStatus', v_previous_status,
        'status', v_dispute.status,
        'sourceEventId', p_source_event_id,
        'effectiveAccessState', v_effective_access_state,
        'accessChanged', v_access_changed
      )
    );
  end if;

  return jsonb_build_object(
    'applied', true, 'state_changed', v_state_changed,
    'access_changed', v_access_changed,
    'effective_access_state', v_effective_access_state,
    'record', to_jsonb(v_dispute)
  );
end;
$$;

create or replace function public.find_digital_access_reconciliation_issues(
  p_limit integer default 100
)
returns table(
  issue_type text,
  order_id uuid,
  store_id uuid,
  entitlement_count integer,
  token_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with digital_orders as (
    select placed_order.id as order_id, placed_order.store_id, placed_order.total_cents
    from public.orders placed_order
    where placed_order.status = 'paid'
      and exists (
        select 1 from public.order_items item
        where item.order_id = placed_order.id and item.product_type = 'digital'
      )
  ), state as (
    select digital_order.*,
      (select count(*)::integer from public.digital_order_entitlements entitlement
       where entitlement.order_id = digital_order.order_id) as entitlement_count,
      (select count(*)::integer from public.digital_order_access_tokens token
       where token.order_id = digital_order.order_id and token.revoked_at is null) as token_count,
      exists (
        select 1 from public.digital_delivery_jobs job
        where job.order_id = digital_order.order_id and job.job_type = 'purchase_delivery'
      ) as has_delivery_job,
      exists (
        select 1 from public.order_refunds refund
        where refund.order_id = digital_order.order_id and refund.status = 'succeeded'
      ) and coalesce((
        select sum(refund.amount_cents) from public.order_refunds refund
        where refund.order_id = digital_order.order_id and refund.status = 'succeeded'
      ), 0) >= greatest(digital_order.total_cents, 1) as fully_refunded,
      exists (
        select 1 from public.order_disputes dispute
        where dispute.order_id = digital_order.order_id and dispute.status = 'lost'
      ) as has_lost_dispute,
      exists (
        select 1 from public.order_disputes dispute
        where dispute.order_id = digital_order.order_id
          and dispute.status in (
            'warning_needs_response', 'warning_under_review',
            'needs_response', 'under_review'
          )
      ) as has_open_dispute
    from digital_orders digital_order
  ), issues as (
    select 'paid_order_missing_delivery_job'::text as issue_type,
      state.order_id, state.store_id, state.entitlement_count, state.token_count
    from state where not state.has_delivery_job
    union all
    select 'paid_order_missing_entitlements',
      state.order_id, state.store_id, state.entitlement_count, state.token_count
    from state where state.entitlement_count = 0
    union all
    select 'full_refund_active_access',
      state.order_id, state.store_id, state.entitlement_count, state.token_count
    from state
    where state.fully_refunded and exists (
      select 1 from public.digital_order_entitlements entitlement
      where entitlement.order_id = state.order_id
        and (
          entitlement.status <> 'revoked'
          or entitlement.status_reason is distinct from 'full_refund'
          or entitlement.status_source_dispute_id is not null
        )
    )
    union all
    select 'open_dispute_access_mismatch',
      state.order_id, state.store_id, state.entitlement_count, state.token_count
    from state
    where not state.fully_refunded and not state.has_lost_dispute
      and state.has_open_dispute and exists (
        select 1 from public.digital_order_entitlements entitlement
        where entitlement.order_id = state.order_id
          and (
            entitlement.status <> 'suspended'
            or entitlement.status_reason is distinct from 'dispute_open'
            or not exists (
              select 1 from public.order_disputes dispute
              where dispute.id = entitlement.status_source_dispute_id
                and dispute.order_id = state.order_id
                and dispute.status in (
                  'warning_needs_response', 'warning_under_review',
                  'needs_response', 'under_review'
                )
            )
          )
      )
    union all
    select 'lost_dispute_access_mismatch',
      state.order_id, state.store_id, state.entitlement_count, state.token_count
    from state
    where not state.fully_refunded and state.has_lost_dispute and exists (
      select 1 from public.digital_order_entitlements entitlement
      where entitlement.order_id = state.order_id
        and (
          entitlement.status <> 'revoked'
          or entitlement.status_reason is distinct from 'dispute_lost'
          or not exists (
            select 1 from public.order_disputes dispute
            where dispute.id = entitlement.status_source_dispute_id
              and dispute.order_id = state.order_id and dispute.status = 'lost'
          )
        )
    )
    union all
    select 'token_access_mismatch',
      state.order_id, state.store_id, state.entitlement_count, state.token_count
    from state
    where (state.fully_refunded or state.has_lost_dispute) and state.token_count > 0
  )
  select issues.issue_type, issues.order_id, issues.store_id,
    issues.entitlement_count, issues.token_count
  from issues
  order by issues.issue_type, issues.order_id
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke all on function public.apply_digital_financial_access_state(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.sync_refund_digital_access(uuid,text,text,text,text,text,uuid,text,timestamptz)
  from public, anon, authenticated;
revoke all on function public.sync_dispute_digital_access(uuid,uuid,text,text,text,integer,text,text,text,boolean,timestamptz,jsonb,text,timestamptz)
  from public, anon, authenticated;
revoke all on function public.find_digital_access_reconciliation_issues(integer)
  from public, anon, authenticated;

grant execute on function public.sync_refund_digital_access(uuid,text,text,text,text,text,uuid,text,timestamptz)
  to service_role;
grant execute on function public.sync_dispute_digital_access(uuid,uuid,text,text,text,integer,text,text,text,boolean,timestamptz,jsonb,text,timestamptz)
  to service_role;
grant execute on function public.find_digital_access_reconciliation_issues(integer)
  to service_role;
