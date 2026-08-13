create table public.digital_acceptance_targets (
  store_id uuid primary key references public.stores(id) on delete cascade,
  run_id uuid not null unique,
  environment text not null check (environment in ('test','preview')),
  project_ref text not null check (project_ref ~ '^[a-z0-9-]{6,64}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at > created_at and expires_at <= created_at + interval '24 hours')
);
alter table public.digital_acceptance_targets enable row level security;
revoke all on table public.digital_acceptance_targets from public, anon, authenticated;

create table public.digital_acceptance_actions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  store_id uuid not null,
  order_id uuid not null,
  action text not null check (action in ('reset','expire-access','inject-delivery-failure','inject-refund','inject-dispute')),
  transition text,
  idempotency_key uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique(run_id, idempotency_key),
  foreign key(store_id) references public.digital_acceptance_targets(store_id) on delete cascade,
  foreign key(order_id,store_id) references public.orders(id,store_id) on delete cascade
);
alter table public.digital_acceptance_actions enable row level security;
revoke all on table public.digital_acceptance_actions from public, anon, authenticated;

create or replace function public.acceptance_control_digital_products(
  p_version integer, p_action text, p_run_id uuid, p_subject_id uuid,
  p_transition text, p_idempotency_key uuid, p_environment text, p_project_ref text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_target public.digital_acceptance_targets%rowtype; v_order public.orders%rowtype; v_store uuid; v_result jsonb; v_refund_id uuid;
begin
  if p_version <> 1 or p_action not in ('reset','expire-access','inject-delivery-failure','inject-refund','inject-dispute')
    or p_idempotency_key is null then raise exception 'acceptance_control_invalid'; end if;
  if (p_action='inject-refund' and p_transition not in ('partial','full'))
    or (p_action='inject-dispute' and p_transition not in ('opened','won','lost'))
    or (p_action not in ('inject-refund','inject-dispute') and p_transition is not null)
  then raise exception 'acceptance_control_transition_invalid'; end if;
  if p_environment not in ('test','preview') or nullif(trim(p_project_ref),'') is null then raise exception 'acceptance_control_nonproduction_required'; end if;
  select * into v_target from public.digital_acceptance_targets where run_id=p_run_id and active and expires_at>now() for update;
  if not found or v_target.environment<>p_environment
    or v_target.project_ref<>p_project_ref then raise exception 'acceptance_control_target_invalid'; end if;
  select * into v_order from public.orders where id=p_subject_id;
  v_store := v_order.store_id;
  if v_store is distinct from v_target.store_id then raise exception 'acceptance_control_subject_invalid'; end if;
  select result into v_result from public.digital_acceptance_actions where run_id=p_run_id and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  if p_action='expire-access' then
    update public.digital_order_access_tokens set expires_at=least(expires_at,now()-interval '1 second') where order_id=p_subject_id and store_id=v_store;
  elsif p_action='inject-delivery-failure' then
    update public.digital_delivery_jobs set status='failed', lease_expires_at=null, lease_token=null,
      completed_at=now(), last_safe_error='Acceptance-injected retryable provider failure', updated_at=now()
      where order_id=p_subject_id and store_id=v_store and job_type='purchase_delivery';
  elsif p_action='inject-refund' then
    insert into public.order_refunds(order_id,store_id,amount_cents,reason_key,status,stripe_refund_id)
      values(p_subject_id,v_store,case when p_transition='full' then v_order.total_cents else greatest(1,v_order.total_cents/2) end,
        'acceptance_test','processing','re_acceptance_'||replace(p_idempotency_key::text,'-','')) returning id into v_refund_id;
    perform public.sync_refund_digital_access(v_refund_id,'re_acceptance_'||replace(p_idempotency_key::text,'-',''),'succeeded','succeeded',null,null,null,
      'evt_acceptance_'||replace(p_idempotency_key::text,'-',''),now());
  elsif p_action='inject-dispute' then
    if nullif(v_order.stripe_payment_intent_id,'') is null then raise exception 'acceptance_control_provider_order_required'; end if;
    perform public.sync_dispute_digital_access(p_subject_id,v_store,'dp_acceptance_'||p_run_id::text,null,v_order.stripe_payment_intent_id,
      greatest(1,v_order.total_cents),v_order.currency,'fraudulent',case p_transition when 'opened' then 'needs_response' when 'won' then 'won' else 'lost' end,
      false,null,jsonb_build_object('acceptanceRunId',p_run_id),'evt_acceptance_'||replace(p_idempotency_key::text,'-',''),now());
  end if;
  v_result=jsonb_build_object('version',1,'action',p_action,'transition',p_transition,'runId',p_run_id,'orderId',p_subject_id,'storeId',v_store);
  insert into public.digital_acceptance_actions(run_id,store_id,order_id,action,transition,idempotency_key,result)
    values(p_run_id,v_store,p_subject_id,p_action,p_transition,p_idempotency_key,v_result);
  return v_result;
end $$;
revoke all on function public.acceptance_control_digital_products(integer,text,uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.acceptance_control_digital_products(integer,text,uuid,uuid,text,uuid,text,text) to service_role;
