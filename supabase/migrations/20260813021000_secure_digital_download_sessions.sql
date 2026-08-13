create or replace function public.authorize_digital_download_session(p_access_token_id uuid)
returns table(
  access_token_id uuid,
  order_id uuid,
  store_id uuid,
  expires_at timestamptz,
  store_name text,
  store_slug text,
  license_version text
)
language sql
security definer
set search_path = public
as $$
  select token.id, token.order_id, token.store_id, token.expires_at,
         store.name, store.slug, coalesce(orders.digital_license_version, 'personal-use-v1')
  from public.digital_order_access_tokens token
  join public.orders on orders.id = token.order_id and orders.store_id = token.store_id
  join public.stores store on store.id = token.store_id
  where token.id = p_access_token_id
    and token.revoked_at is null
    and token.expires_at > now()
    and public.is_digital_download_order_eligible(token.order_id, token.store_id)
  limit 1
$$;

revoke all on function public.authorize_digital_download_session(uuid) from public, anon, authenticated;
grant execute on function public.authorize_digital_download_session(uuid) to service_role;
