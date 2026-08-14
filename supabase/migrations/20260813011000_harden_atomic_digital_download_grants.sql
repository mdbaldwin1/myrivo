-- Close upgrade and lock-wait gaps in atomic download grants. Existing issued
-- grants must agree with the entitlement counter before this migration can
-- proceed; a deferred invariant then preserves that agreement transactionally.

do $$
begin
  if exists (
    select 1
    from public.digital_order_entitlements entitlement
    where entitlement.max_download_grants <> 5
       or entitlement.download_grants_used <> (
         select count(*)
         from public.digital_download_grants grant_row
         where grant_row.entitlement_id = entitlement.id
           and grant_row.status = 'issued'
       )
       or entitlement.download_grants_used > 5
  ) then
    raise exception 'Digital download grant accounting requires administrative review';
  end if;
end;
$$;

create or replace function public.check_digital_download_grant_accounting(
  p_entitlement_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_used integer;
  v_max integer;
  v_issued bigint;
begin
  select
    entitlement.download_grants_used,
    entitlement.max_download_grants
  into v_used, v_max
  from public.digital_order_entitlements entitlement
  where entitlement.id = p_entitlement_id;

  if not found then
    return;
  end if;

  select count(*) into v_issued
  from public.digital_download_grants grant_row
  where grant_row.entitlement_id = p_entitlement_id
    and grant_row.status = 'issued';

  if v_max <> 5 or v_used <> v_issued or v_issued > 5 then
    raise exception 'Digital download grant accounting invariant violated'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.check_digital_download_grant_accounting(uuid)
from public, anon, authenticated, service_role;

create or replace function public.enforce_digital_download_grant_accounting()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'digital_order_entitlements' then
    perform public.check_digital_download_grant_accounting(new.id);
  else
    perform public.check_digital_download_grant_accounting(
      coalesce(new.entitlement_id, old.entitlement_id)
    );
    if tg_op = 'UPDATE'
       and new.entitlement_id is distinct from old.entitlement_id
    then
      perform public.check_digital_download_grant_accounting(old.entitlement_id);
    end if;
  end if;
  return null;
end;
$$;

revoke all on function public.enforce_digital_download_grant_accounting()
from public, anon, authenticated, service_role;

drop trigger if exists digital_entitlement_grant_accounting_check
on public.digital_order_entitlements;
create constraint trigger digital_entitlement_grant_accounting_check
after insert or update of download_grants_used, max_download_grants
on public.digital_order_entitlements
deferrable initially deferred
for each row
execute function public.enforce_digital_download_grant_accounting();

drop trigger if exists digital_grant_accounting_check
on public.digital_download_grants;
create constraint trigger digital_grant_accounting_check
after insert or update of status, entitlement_id or delete
on public.digital_download_grants
deferrable initially deferred
for each row
execute function public.enforce_digital_download_grant_accounting();

create or replace function public.reserve_digital_download_grant(
  p_entitlement_id uuid,
  p_access_token_id uuid,
  p_reservation_key text,
  p_client_fingerprint_hash text
)
returns table(
  grant_id uuid,
  store_id uuid,
  product_id uuid,
  asset_id uuid,
  asset_version_id uuid,
  customer_filename text,
  grant_status text,
  reservation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz;
  v_probe_order_id uuid;
  v_probe_store_id uuid;
  v_conflicting_entitlement_id uuid;
  v_entitlement public.digital_order_entitlements%rowtype;
  v_access public.digital_order_access_tokens%rowtype;
  v_existing public.digital_download_grants%rowtype;
  v_grant public.digital_download_grants%rowtype;
  v_active_reservations integer;
begin
  if p_reservation_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or p_client_fingerprint_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'Invalid download reservation';
  end if;

  select grant_row.entitlement_id into v_conflicting_entitlement_id
  from public.digital_download_grants grant_row
  where grant_row.reservation_key = p_reservation_key;

  if found and v_conflicting_entitlement_id <> p_entitlement_id then
    raise exception 'Download reservation conflict';
  end if;

  select entitlement.order_id, entitlement.store_id
  into v_probe_order_id, v_probe_store_id
  from public.digital_order_entitlements entitlement
  where entitlement.id = p_entitlement_id;

  if not found then
    raise exception 'Download unavailable';
  end if;

  perform 1
  from public.orders placed_order
  where placed_order.id = v_probe_order_id
    and placed_order.store_id = v_probe_store_id
  for share;

  if not found then
    raise exception 'Download unavailable';
  end if;

  select * into v_access
  from public.digital_order_access_tokens token
  where token.id = p_access_token_id
    and token.order_id = v_probe_order_id
    and token.store_id = v_probe_store_id
  for share;

  if not found then
    raise exception 'Download unavailable';
  end if;

  select * into v_entitlement
  from public.digital_order_entitlements entitlement
  where entitlement.id = p_entitlement_id
    and entitlement.order_id = v_probe_order_id
    and entitlement.store_id = v_probe_store_id
  for update;

  if not found then
    raise exception 'Download unavailable';
  end if;

  perform 1
  from public.digital_download_grants grant_row
  where grant_row.entitlement_id = p_entitlement_id
  order by grant_row.id
  for update;

  -- clock_timestamp() must be read only after every potentially blocking lock.
  v_now := clock_timestamp();

  if v_entitlement.status <> 'active'
     or v_entitlement.max_download_grants <> 5
     or v_access.revoked_at is not null
     or v_access.expires_at <= v_now
     or not public.is_digital_download_order_eligible(
       v_entitlement.order_id,
       v_entitlement.store_id
     )
  then
    raise exception 'Download unavailable';
  end if;

  select * into v_existing
  from public.digital_download_grants grant_row
  where grant_row.reservation_key = p_reservation_key;

  if found then
    if v_existing.entitlement_id <> p_entitlement_id
       or v_existing.access_token_id is distinct from p_access_token_id
       or v_existing.client_fingerprint_hash <> p_client_fingerprint_hash
    then
      raise exception 'Download reservation conflict';
    end if;
    if not (
      (
        v_existing.status = 'reserved'
        and v_existing.reservation_expires_at > v_now
      )
      or (
        v_existing.status = 'issued'
        and v_existing.grace_expires_at > v_now
      )
    ) then
      raise exception 'Download reservation unavailable';
    end if;
    return query select
      v_existing.id,
      v_entitlement.store_id,
      v_entitlement.product_id,
      v_entitlement.asset_id,
      v_entitlement.asset_version_id,
      v_entitlement.customer_filename,
      v_existing.status,
      v_existing.reservation_expires_at;
    return;
  end if;

  update public.digital_download_grants grant_row
  set status = 'released',
      released_at = v_now,
      last_safe_error = 'Reservation expired'
  where grant_row.entitlement_id = p_entitlement_id
    and grant_row.status = 'reserved'
    and grant_row.reservation_expires_at <= v_now;

  select * into v_existing
  from public.digital_download_grants grant_row
  where grant_row.entitlement_id = p_entitlement_id
    and grant_row.access_token_id = p_access_token_id
    and grant_row.client_fingerprint_hash = p_client_fingerprint_hash
    and grant_row.status = 'issued'
    and grant_row.grace_expires_at > v_now
  order by grant_row.grace_expires_at desc, grant_row.id
  limit 1;

  if found then
    return query select
      v_existing.id,
      v_entitlement.store_id,
      v_entitlement.product_id,
      v_entitlement.asset_id,
      v_entitlement.asset_version_id,
      v_entitlement.customer_filename,
      v_existing.status,
      v_existing.reservation_expires_at;
    return;
  end if;

  select * into v_existing
  from public.digital_download_grants grant_row
  where grant_row.entitlement_id = p_entitlement_id
    and grant_row.access_token_id = p_access_token_id
    and grant_row.client_fingerprint_hash = p_client_fingerprint_hash
    and grant_row.status = 'reserved'
    and grant_row.reservation_expires_at > v_now
  order by grant_row.reservation_expires_at desc, grant_row.id
  limit 1;

  if found then
    return query select
      v_existing.id,
      v_entitlement.store_id,
      v_entitlement.product_id,
      v_entitlement.asset_id,
      v_entitlement.asset_version_id,
      v_entitlement.customer_filename,
      v_existing.status,
      v_existing.reservation_expires_at;
    return;
  end if;

  select count(*) into v_active_reservations
  from public.digital_download_grants grant_row
  where grant_row.entitlement_id = p_entitlement_id
    and grant_row.status = 'reserved'
    and grant_row.reservation_expires_at > v_now;

  if v_entitlement.download_grants_used + v_active_reservations >= 5 then
    raise exception 'Download limit reached';
  end if;

  insert into public.digital_download_grants(
    store_id,
    order_id,
    entitlement_id,
    access_token_id,
    reservation_key,
    client_fingerprint_hash,
    status,
    reserved_at,
    reservation_expires_at
  ) values (
    v_entitlement.store_id,
    v_entitlement.order_id,
    p_entitlement_id,
    p_access_token_id,
    p_reservation_key,
    p_client_fingerprint_hash,
    'reserved',
    v_now,
    v_now + interval '5 minutes'
  )
  returning * into v_grant;

  return query select
    v_grant.id,
    v_entitlement.store_id,
    v_entitlement.product_id,
    v_entitlement.asset_id,
    v_entitlement.asset_version_id,
    v_entitlement.customer_filename,
    v_grant.status,
    v_grant.reservation_expires_at;
end;
$$;

create or replace function public.commit_digital_download_grant(
  p_grant_id uuid,
  p_client_fingerprint_hash text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz;
  v_probe public.digital_download_grants%rowtype;
  v_grant public.digital_download_grants%rowtype;
  v_entitlement public.digital_order_entitlements%rowtype;
  v_access public.digital_order_access_tokens%rowtype;
begin
  if p_client_fingerprint_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Download reservation unavailable';
  end if;

  select * into v_probe
  from public.digital_download_grants grant_row
  where grant_row.id = p_grant_id;

  if not found
     or v_probe.client_fingerprint_hash <> p_client_fingerprint_hash
     or v_probe.access_token_id is null
  then
    raise exception 'Download reservation unavailable';
  end if;

  perform 1
  from public.orders placed_order
  where placed_order.id = v_probe.order_id
    and placed_order.store_id = v_probe.store_id
  for share;

  if not found then
    raise exception 'Download unavailable';
  end if;

  select * into v_access
  from public.digital_order_access_tokens token
  where token.id = v_probe.access_token_id
    and token.order_id = v_probe.order_id
    and token.store_id = v_probe.store_id
  for share;

  if not found then
    raise exception 'Download unavailable';
  end if;

  select * into v_entitlement
  from public.digital_order_entitlements entitlement
  where entitlement.id = v_probe.entitlement_id
    and entitlement.order_id = v_probe.order_id
    and entitlement.store_id = v_probe.store_id
  for update;

  if not found then
    raise exception 'Download unavailable';
  end if;

  perform 1
  from public.digital_download_grants grant_row
  where grant_row.entitlement_id = v_probe.entitlement_id
  order by grant_row.id
  for update;

  select * into v_grant
  from public.digital_download_grants grant_row
  where grant_row.id = p_grant_id;

  if not found
     or v_grant.entitlement_id <> v_probe.entitlement_id
     or v_grant.order_id <> v_probe.order_id
     or v_grant.store_id <> v_probe.store_id
     or v_grant.access_token_id is distinct from v_probe.access_token_id
     or v_grant.client_fingerprint_hash <> p_client_fingerprint_hash
  then
    raise exception 'Download reservation unavailable';
  end if;

  -- Evaluate token, reservation, and grace boundaries after lock waits finish.
  v_now := clock_timestamp();

  if v_entitlement.status <> 'active'
     or v_entitlement.max_download_grants <> 5
     or v_access.revoked_at is not null
     or v_access.expires_at <= v_now
     or not public.is_digital_download_order_eligible(
       v_grant.order_id,
       v_grant.store_id
     )
  then
    raise exception 'Download unavailable';
  end if;

  if v_grant.status = 'issued' then
    return 'issued';
  end if;
  if v_grant.status <> 'reserved'
     or v_grant.reservation_expires_at <= v_now
  then
    raise exception 'Download reservation unavailable';
  end if;

  update public.digital_order_entitlements entitlement
  set download_grants_used = entitlement.download_grants_used + 1,
      first_accessed_at = coalesce(entitlement.first_accessed_at, v_now),
      last_accessed_at = v_now
  where entitlement.id = v_grant.entitlement_id
    and entitlement.status = 'active'
    and entitlement.download_grants_used < 5;

  if not found then
    raise exception 'Download unavailable';
  end if;

  update public.digital_download_grants grant_row
  set status = 'issued',
      issued_at = v_now,
      grace_expires_at = v_now + interval '60 seconds'
  where grant_row.id = v_grant.id
    and grant_row.status = 'reserved';

  if not found then
    raise exception 'Download reservation unavailable';
  end if;
  return 'issued';
end;
$$;

create or replace function public.release_digital_download_grant(
  p_grant_id uuid,
  p_client_fingerprint_hash text,
  p_safe_error text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz;
  v_grant public.digital_download_grants%rowtype;
begin
  if p_client_fingerprint_hash !~ '^[a-f0-9]{64}$'
     or (
       p_safe_error is not null
       and char_length(trim(p_safe_error)) not between 1 and 500
     )
  then
    raise exception 'Download reservation unavailable';
  end if;

  select * into v_grant
  from public.digital_download_grants grant_row
  where grant_row.id = p_grant_id
  for update;

  v_now := clock_timestamp();

  if not found
     or v_grant.client_fingerprint_hash <> p_client_fingerprint_hash
  then
    raise exception 'Download reservation unavailable';
  end if;
  if v_grant.status = 'issued' then
    return 'issued';
  end if;
  if v_grant.status = 'released' then
    return 'released';
  end if;
  if v_grant.status <> 'reserved' then
    raise exception 'Download reservation unavailable';
  end if;

  update public.digital_download_grants grant_row
  set status = 'released',
      released_at = v_now,
      last_safe_error = nullif(trim(p_safe_error), '')
  where grant_row.id = v_grant.id;
  return 'released';
end;
$$;

create or replace function public.release_digital_download_reservation(
  p_entitlement_id uuid,
  p_access_token_id uuid,
  p_reservation_key text,
  p_client_fingerprint_hash text,
  p_safe_error text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz;
  v_grant public.digital_download_grants%rowtype;
begin
  if p_reservation_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or p_client_fingerprint_hash !~ '^[a-f0-9]{64}$'
     or (
       p_safe_error is not null
       and char_length(trim(p_safe_error)) not between 1 and 500
     )
  then
    raise exception 'Download reservation unavailable';
  end if;

  select * into v_grant
  from public.digital_download_grants grant_row
  where grant_row.entitlement_id = p_entitlement_id
    and grant_row.access_token_id = p_access_token_id
    and grant_row.reservation_key = p_reservation_key
    and grant_row.client_fingerprint_hash = p_client_fingerprint_hash
  for update;

  v_now := clock_timestamp();

  if not found then
    return 'missing';
  end if;
  if v_grant.status = 'issued' then
    return 'issued';
  end if;
  if v_grant.status = 'released' then
    return 'released';
  end if;
  if v_grant.status <> 'reserved' then
    return 'missing';
  end if;

  update public.digital_download_grants grant_row
  set status = 'released',
      released_at = v_now,
      last_safe_error = nullif(trim(p_safe_error), '')
  where grant_row.id = v_grant.id;
  return 'released';
end;
$$;

revoke all on function public.reserve_digital_download_grant(uuid, uuid, text, text)
from public, anon, authenticated;
revoke all on function public.commit_digital_download_grant(uuid, text)
from public, anon, authenticated;
revoke all on function public.release_digital_download_grant(uuid, text, text)
from public, anon, authenticated;
revoke all on function public.release_digital_download_reservation(uuid, uuid, text, text, text)
from public, anon, authenticated;

grant execute on function public.reserve_digital_download_grant(uuid, uuid, text, text)
to service_role;
grant execute on function public.commit_digital_download_grant(uuid, text)
to service_role;
grant execute on function public.release_digital_download_grant(uuid, text, text)
to service_role;
grant execute on function public.release_digital_download_reservation(uuid, uuid, text, text, text)
to service_role;
