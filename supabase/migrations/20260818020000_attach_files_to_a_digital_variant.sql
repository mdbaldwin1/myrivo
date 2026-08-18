-- Attaching files follows fulfillment down to the variant.
--
-- A product that ships by default but offers one variant as a download could
-- not have a file attached to it at all: the gate asked whether the product was
-- digital, and it was not. It now asks whether anything about the product is.

create or replace function public.product_involves_digital(p_product_id uuid, p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.products product
    left join public.product_variants variant
      on variant.product_id = product.id
     and variant.store_id = product.store_id
     and variant.status = 'active'
    where product.id = p_product_id
      and product.store_id = p_store_id
      and coalesce(variant.fulfillment_type, product.product_type) = 'digital'
  );
$$;

revoke all on function public.product_involves_digital(uuid, uuid) from public;
grant execute on function public.product_involves_digital(uuid, uuid) to service_role;

create or replace function public.create_digital_asset_upload_intent(
  p_intent_id uuid,
  p_store_id uuid,
  p_product_id uuid,
  p_product_variant_id uuid,
  p_asset_id uuid,
  p_asset_version_id uuid,
  p_existing_asset_id uuid,
  p_label text,
  p_expected_filename text,
  p_expected_mime_type text,
  p_expected_byte_size bigint,
  p_storage_path text,
  p_operation text,
  p_expires_at timestamptz
)
returns table(
  intent_id uuid,
  asset_id uuid,
  asset_version_id uuid,
  product_id uuid,
  product_variant_id uuid,
  storage_path text,
  expected_filename text,
  expected_mime_type text,
  expected_byte_size bigint,
  version_number integer,
  operation text,
  intent_status text,
  expires_at timestamptz,
  completed_version_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product_id uuid;
  v_product_variant_id uuid;
  v_label text;
  v_version_number integer;
  v_extension text;
  v_storage_path text;
  v_active_count integer;
begin
  if p_operation not in ('create', 'replace') then
    raise exception 'Invalid digital asset upload operation';
  end if;
  if p_expected_byte_size < 1
    or p_expected_byte_size > public.digital_asset_max_file_bytes() then
    raise exception 'Invalid digital asset upload size';
  end if;
  if p_expires_at <= now()
    or p_expires_at > now() + public.digital_asset_max_intent_ttl() then
    raise exception 'Invalid digital asset upload expiry';
  end if;
  v_extension := public.digital_asset_extension_for_mime(
    p_expected_mime_type,
    p_expected_filename
  );

  if p_operation = 'create' then
    select p.id into v_product_id
    from public.products p
    where p.id = p_product_id
      and p.store_id = p_store_id
      and public.product_involves_digital(p.id, p.store_id)
    for update;
    if not found then raise exception 'Digital product unavailable'; end if;

    if p_product_variant_id is not null and not exists (
      select 1 from public.product_variants v
      where v.id = p_product_variant_id
        and v.product_id = p_product_id
        and v.store_id = p_store_id
    ) then
      raise exception 'Digital product variant unavailable';
    end if;

    select
      (select count(*) from public.digital_product_assets a
       where a.product_id = p_product_id and a.store_id = p_store_id and a.active)
      +
      (select count(*) from public.digital_asset_upload_intents i
       where i.product_id = p_product_id and i.store_id = p_store_id
         and i.operation = 'create' and i.status = 'pending' and i.expires_at > now())
    into v_active_count;
    if v_active_count >= public.digital_asset_max_active_files() then
      raise exception 'Digital asset active file limit reached';
    end if;

    v_product_variant_id := p_product_variant_id;
    v_label := trim(p_label);
    v_version_number := 1;
    if char_length(v_label) not between 1 and 160 then
      raise exception 'Invalid digital asset label';
    end if;
    v_storage_path := p_store_id::text || '/' || p_product_id::text || '/' ||
      p_asset_id::text || '/v1/' || public.digital_asset_safe_basename(p_expected_filename) ||
      v_extension;
    if p_existing_asset_id is not null or p_storage_path is distinct from v_storage_path then
      raise exception 'Invalid digital asset storage path';
    end if;
  else
    select a.product_id into v_product_id
    from public.digital_product_assets a
    where a.id = p_existing_asset_id and a.store_id = p_store_id and a.active;
    if not found or p_asset_id is distinct from p_existing_asset_id then
      raise exception 'Digital asset unavailable';
    end if;
    perform 1 from public.products p
    where p.id = v_product_id and p.store_id = p_store_id
      and public.product_involves_digital(p.id, p.store_id)
    for update;
    if not found then raise exception 'Digital product unavailable'; end if;
    select a.product_variant_id, a.label
    into v_product_variant_id, v_label
    from public.digital_product_assets a
    where a.id = p_existing_asset_id and a.store_id = p_store_id and a.active
    for update;
    select greatest(
      coalesce((select max(v.version_number) from public.digital_product_asset_versions v
        where v.asset_id = p_asset_id), 0),
      coalesce((select max(i.version_number) from public.digital_asset_upload_intents i
        where i.asset_id = p_asset_id), 0)
    ) + 1 into v_version_number;
    v_storage_path := p_store_id::text || '/' || v_product_id::text || '/' ||
      p_asset_id::text || '/v' || v_version_number::text || '/' ||
      public.digital_asset_safe_basename(p_expected_filename) || v_extension;
  end if;

  insert into public.digital_asset_upload_intents(
    id, store_id, product_id, product_variant_id, asset_id, asset_version_id,
    existing_asset_id, operation, version_number, label, expected_filename,
    expected_mime_type, expected_byte_size, storage_path, expires_at
  ) values (
    p_intent_id, p_store_id, v_product_id, v_product_variant_id, p_asset_id,
    p_asset_version_id, p_existing_asset_id, p_operation, v_version_number,
    v_label, trim(p_expected_filename), p_expected_mime_type,
    p_expected_byte_size, v_storage_path, p_expires_at
  );

  return query
  select i.id, i.asset_id, i.asset_version_id, i.product_id,
    i.product_variant_id, i.storage_path, i.expected_filename,
    i.expected_mime_type, i.expected_byte_size, i.version_number, i.operation,
    i.status, i.expires_at, i.completed_version_id
  from public.digital_asset_upload_intents i
  where i.id = p_intent_id;
end;
$$;
