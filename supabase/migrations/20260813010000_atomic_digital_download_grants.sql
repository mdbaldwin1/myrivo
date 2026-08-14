-- Make customer downloads authoritative at the database boundary. Reservations
-- serialize on the entitlement, successful grants commit exactly once, and a
-- short same-session grace window can reuse an issued grant without consuming.

do $$
begin
  if exists (
    select 1
    from public.digital_order_entitlements entitlement
    where entitlement.download_grants_used > 5
       or (
         select count(*)
         from public.digital_download_grants grant_row
         where grant_row.entitlement_id = entitlement.id
           and grant_row.status = 'issued'
       ) > 5
  ) then
    raise exception 'Digital entitlement grant usage requires administrative review';
  end if;
end;
$$;

update public.digital_order_entitlements
set max_download_grants = 5
where max_download_grants <> 5;

alter table public.digital_order_entitlements
  drop constraint if exists digital_order_entitlements_five_grants_check,
  add constraint digital_order_entitlements_five_grants_check
    check (max_download_grants = 5);

create index if not exists digital_download_grants_active_reservation_idx
  on public.digital_download_grants(
    entitlement_id,
    client_fingerprint_hash,
    reservation_expires_at desc,
    id
  )
  where status = 'reserved';

create index if not exists digital_download_grants_grace_reuse_idx
  on public.digital_download_grants(
    entitlement_id,
    client_fingerprint_hash,
    grace_expires_at desc,
    id
  )
  where status = 'issued';

create or replace function public.is_digital_download_order_eligible(
  p_order_id uuid,
  p_store_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.orders placed_order
    where placed_order.id = p_order_id
      and placed_order.store_id = p_store_id
      and placed_order.status = 'paid'
      and not (
        placed_order.total_cents > 0
        and coalesce((
          select sum(refund.amount_cents)
          from public.order_refunds refund
          where refund.order_id = placed_order.id
            and refund.store_id = placed_order.store_id
            and refund.status = 'succeeded'
        ), 0) >= placed_order.total_cents
      )
      and not exists (
        select 1
        from public.order_disputes dispute
        where dispute.order_id = placed_order.id
          and dispute.store_id = placed_order.store_id
          and dispute.status in (
            'warning_needs_response',
            'warning_under_review',
            'needs_response',
            'under_review',
            'lost'
          )
      )
  )
$$;

revoke all on function public.is_digital_download_order_eligible(uuid, uuid)
from public, anon, authenticated, service_role;

create or replace function public.authorize_digital_download_access(
  p_token_hash text
)
returns table(
  access_token_id uuid,
  order_id uuid,
  store_id uuid,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    token.id,
    token.order_id,
    token.store_id,
    token.expires_at
  from public.digital_order_access_tokens token
  where p_token_hash ~ '^[a-f0-9]{64}$'
    and token.token_hash = p_token_hash
    and token.revoked_at is null
    and token.expires_at > clock_timestamp()
    and public.is_digital_download_order_eligible(token.order_id, token.store_id)
  limit 1
$$;

create or replace function public.list_authorized_digital_downloads(
  p_access_token_id uuid
)
returns table(
  entitlement_id uuid,
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
       v_access.order_id,
       v_access.store_id
     )
  then
    return;
  end if;

  return query
  select
    entitlement.id,
    entitlement.customer_filename,
    entitlement.mime_type,
    entitlement.byte_size,
    entitlement.status,
    greatest(
      entitlement.max_download_grants - entitlement.download_grants_used,
      0
    )
  from public.digital_order_entitlements entitlement
  where entitlement.order_id = v_access.order_id
    and entitlement.store_id = v_access.store_id
  order by entitlement.created_at, entitlement.id;
end;
$$;

drop function if exists public.reserve_digital_download_grant(
  uuid,
  uuid,
  text,
  text
);

create function public.reserve_digital_download_grant(
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
  v_now timestamptz := clock_timestamp();
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

  select * into v_entitlement
  from public.digital_order_entitlements entitlement
  where entitlement.id = p_entitlement_id
  for update;

  if not found
     or v_entitlement.status <> 'active'
     or v_entitlement.max_download_grants <> 5
  then
    raise exception 'Download unavailable';
  end if;

  select * into v_access
  from public.digital_order_access_tokens token
  where token.id = p_access_token_id
    and token.order_id = v_entitlement.order_id
    and token.store_id = v_entitlement.store_id
    and token.revoked_at is null
    and token.expires_at > v_now
  for share;

  if not found
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
  v_now timestamptz := clock_timestamp();
  v_grant public.digital_download_grants%rowtype;
  v_entitlement public.digital_order_entitlements%rowtype;
begin
  if p_client_fingerprint_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Download reservation unavailable';
  end if;

  select * into v_grant
  from public.digital_download_grants grant_row
  where grant_row.id = p_grant_id
  for update;

  if not found
     or v_grant.client_fingerprint_hash <> p_client_fingerprint_hash
     or v_grant.access_token_id is null
  then
    raise exception 'Download reservation unavailable';
  end if;

  select * into v_entitlement
  from public.digital_order_entitlements entitlement
  where entitlement.id = v_grant.entitlement_id
    and entitlement.order_id = v_grant.order_id
    and entitlement.store_id = v_grant.store_id
  for update;

  if not found
     or v_entitlement.status <> 'active'
     or v_entitlement.max_download_grants <> 5
     or not exists (
       select 1
       from public.digital_order_access_tokens token
       where token.id = v_grant.access_token_id
         and token.order_id = v_grant.order_id
         and token.store_id = v_grant.store_id
         and token.revoked_at is null
         and token.expires_at > v_now
     )
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
  v_now timestamptz := clock_timestamp();
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

revoke all on function public.authorize_digital_download_access(text)
from public, anon, authenticated;
revoke all on function public.list_authorized_digital_downloads(uuid)
from public, anon, authenticated;
revoke all on function public.reserve_digital_download_grant(uuid, uuid, text, text)
from public, anon, authenticated;
revoke all on function public.commit_digital_download_grant(uuid, text)
from public, anon, authenticated;
revoke all on function public.release_digital_download_grant(uuid, text, text)
from public, anon, authenticated;

grant execute on function public.authorize_digital_download_access(text)
to service_role;
grant execute on function public.list_authorized_digital_downloads(uuid)
to service_role;
grant execute on function public.reserve_digital_download_grant(uuid, uuid, text, text)
to service_role;
grant execute on function public.commit_digital_download_grant(uuid, text)
to service_role;
grant execute on function public.release_digital_download_grant(uuid, text, text)
to service_role;
