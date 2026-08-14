-- Bind a completed preview's public object path to the exact source version
-- and processing generation that owns the current lease.

create or replace function public.complete_digital_product_preview(
  p_store_id uuid,
  p_product_id uuid,
  p_source_asset_version_id uuid,
  p_public_preview_path text,
  p_processing_generation uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expected_path text;
begin
  v_expected_path := p_store_id::text || '/' || p_product_id::text ||
    '/watermarked-' || p_source_asset_version_id::text || '-' ||
    p_processing_generation::text || '.jpg';

  if p_public_preview_path is distinct from v_expected_path then
    raise exception 'Invalid digital preview path';
  end if;

  update public.digital_product_previews p
  set status = 'ready', public_preview_path = v_expected_path,
      is_merchant_override = false, failure_reason = null,
      processing_lease_expires_at = null
  where p.product_id = p_product_id and p.store_id = p_store_id
    and p.source_asset_version_id = p_source_asset_version_id
    and p.status = 'processing'
    and p.processing_generation = p_processing_generation
    and p.processing_lease_expires_at > now();
  return found;
end;
$$;

revoke all on function public.complete_digital_product_preview(uuid, uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.complete_digital_product_preview(uuid, uuid, uuid, text, uuid)
  to service_role;
