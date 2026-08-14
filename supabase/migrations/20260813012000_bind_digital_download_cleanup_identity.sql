-- Malformed reserve responses are cleaned up exclusively by request identity.
-- Never use untrusted response metadata to select the row, and never mutate a
-- reservation after another transaction has issued or otherwise finalized it.

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
  v_grant_id uuid;
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

  select grant_row.id into v_grant_id
  from public.digital_download_grants grant_row
  where grant_row.entitlement_id = p_entitlement_id
    and grant_row.access_token_id = p_access_token_id
    and grant_row.reservation_key = p_reservation_key
    and grant_row.client_fingerprint_hash = p_client_fingerprint_hash
    and grant_row.status = 'reserved'
  for update;

  if not found then
    return 'missing';
  end if;

  v_now := clock_timestamp();

  update public.digital_download_grants grant_row
  set status = 'released',
      released_at = v_now,
      last_safe_error = nullif(trim(p_safe_error), '')
  where grant_row.id = v_grant_id
    and grant_row.status = 'reserved';

  if not found then
    return 'missing';
  end if;
  return 'released';
end;
$$;

revoke all on function public.release_digital_download_reservation(uuid, uuid, text, text, text)
from public, anon, authenticated;
grant execute on function public.release_digital_download_reservation(uuid, uuid, text, text, text)
to service_role;
