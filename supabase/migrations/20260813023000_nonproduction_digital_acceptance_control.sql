create table public.digital_acceptance_configuration (
  singleton boolean primary key default true check (singleton),
  environment text not null check (environment in ('test','preview')),
  project_ref text not null check (project_ref ~ '^[a-z0-9-]{6,64}$'),
  active boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.digital_acceptance_configuration enable row level security;
revoke all on table public.digital_acceptance_configuration from public, anon, authenticated, service_role;

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
  action text not null check (action in ('expire-access','inject-delivery-failure','inject-refund','inject-dispute')),
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
  p_transition text, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_target public.digital_acceptance_targets%rowtype; v_config public.digital_acceptance_configuration%rowtype; v_order public.orders%rowtype; v_store uuid; v_result jsonb;
begin
  if p_version <> 1 or p_action not in ('observe','expire-access','inject-delivery-failure','inject-refund','inject-dispute')
    or p_idempotency_key is null then raise exception 'acceptance_control_invalid'; end if;
  if (p_action='inject-refund' and p_transition not in ('partial','full'))
    or (p_action='inject-dispute' and p_transition not in ('opened','won','lost'))
    or (p_action not in ('inject-refund','inject-dispute') and p_transition is not null)
  then raise exception 'acceptance_control_transition_invalid'; end if;
  select * into v_config from public.digital_acceptance_configuration where singleton and active;
  if not found then raise exception 'acceptance_control_nonproduction_required'; end if;
  select * into v_target from public.digital_acceptance_targets where run_id=p_run_id and active and expires_at>now() for update;
  if not found or v_config.environment<>v_target.environment
    or v_config.project_ref<>v_target.project_ref then raise exception 'acceptance_control_target_invalid'; end if;
  select * into v_order from public.orders where id=p_subject_id;
  v_store := v_order.store_id;
  if v_store is distinct from v_target.store_id then raise exception 'acceptance_control_subject_invalid'; end if;
  if p_action <> 'observe' then
    select result into v_result from public.digital_acceptance_actions where run_id=p_run_id and idempotency_key=p_idempotency_key;
    if found then return v_result; end if;
  end if;
  if p_action='expire-access' then
    update public.digital_order_access_tokens set expires_at=least(expires_at,now()-interval '1 second') where order_id=p_subject_id and store_id=v_store;
  elsif p_action='inject-delivery-failure' then
    update public.digital_delivery_jobs set status='failed', lease_expires_at=null, lease_token=null,
      completed_at=now(), last_safe_error='Acceptance-injected retryable provider failure', updated_at=now()
      where order_id=p_subject_id and store_id=v_store and job_type='purchase_delivery';
  elsif p_action in ('inject-refund','inject-dispute') then
    raise exception 'acceptance_control_provider_event_required';
  end if;
  v_result=jsonb_build_object('version',1,'action',p_action,'transition',p_transition,'runId',p_run_id,'orderId',p_subject_id,'storeId',v_store);
  if p_action <> 'observe' then
    insert into public.digital_acceptance_actions(run_id,store_id,order_id,action,transition,idempotency_key,result)
      values(p_run_id,v_store,p_subject_id,p_action,p_transition,p_idempotency_key,v_result);
  end if;
  return v_result;
end $$;
revoke all on function public.acceptance_control_digital_products(integer,text,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.acceptance_control_digital_products(integer,text,uuid,uuid,text,uuid) to service_role;
