-- A relation move affects two readiness aggregates. Validate both the OLD and
-- NEW product/store parents after the transaction's final row state is visible.

create or replace function public.enforce_active_digital_product_readiness()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := to_jsonb(old);
  v_new_product_id uuid;
  v_new_store_id uuid;
  v_old_product_id uuid;
  v_old_store_id uuid;
  v_new_asset_id uuid;
  v_old_asset_id uuid;
  v_target record;
  v_product public.products%rowtype;
begin
  if tg_table_name = 'products' then
    v_new_product_id := nullif(v_new ->> 'id', '')::uuid;
    v_new_store_id := nullif(v_new ->> 'store_id', '')::uuid;
    v_old_product_id := nullif(v_old ->> 'id', '')::uuid;
    v_old_store_id := nullif(v_old ->> 'store_id', '')::uuid;
  else
    v_new_product_id := nullif(v_new ->> 'product_id', '')::uuid;
    v_new_store_id := nullif(v_new ->> 'store_id', '')::uuid;
    v_old_product_id := nullif(v_old ->> 'product_id', '')::uuid;
    v_old_store_id := nullif(v_old ->> 'store_id', '')::uuid;
  end if;

  -- The asset is authoritative for version ownership. Resolve OLD and NEW
  -- independently so changing asset_id cannot hide the product losing a ready
  -- version, even when relation-maintenance triggers rewrite NEW product/store.
  if tg_table_name = 'digital_product_asset_versions' then
    v_new_asset_id := nullif(v_new ->> 'asset_id', '')::uuid;
    v_old_asset_id := nullif(v_old ->> 'asset_id', '')::uuid;

    if v_new_asset_id is not null then
      select asset.product_id, asset.store_id
      into v_new_product_id, v_new_store_id
      from public.digital_product_assets asset
      where asset.id = v_new_asset_id;
    end if;

    if v_old_asset_id is not null then
      select asset.product_id, asset.store_id
      into v_old_product_id, v_old_store_id
      from public.digital_product_assets asset
      where asset.id = v_old_asset_id;
    end if;
  end if;

  -- OLD and NEW commonly identify the same parent. DISTINCT avoids duplicate
  -- readiness work; ordering keeps product locks deterministic for moves.
  for v_target in
    select affected.product_id, affected.store_id
    from (values
      (v_old_product_id, v_old_store_id),
      (v_new_product_id, v_new_store_id)
    ) as affected(product_id, store_id)
    where affected.product_id is not null
      and affected.store_id is not null
    group by affected.product_id, affected.store_id
    order by affected.product_id, affected.store_id
  loop
    select * into v_product
    from public.products product
    where product.id = v_target.product_id
      and product.store_id = v_target.store_id
    for share;

    if not found
      or v_product.product_type <> 'digital'
      or v_product.status <> 'active'
    then
      continue;
    end if;

    if v_product.digital_rights_affirmed_at is null
      or not exists (
        select 1 from public.digital_product_previews preview
        where preview.product_id = v_target.product_id
          and preview.store_id = v_target.store_id
          and preview.status = 'ready'
          and preview.public_preview_path is not null
      )
    then
      raise exception using
        errcode = '23514',
        message = 'Active digital product is not ready';
    end if;

    if exists (
      select 1 from public.product_variants variant
      where variant.product_id = v_target.product_id
        and variant.store_id = v_target.store_id
        and variant.status = 'active'
    ) then
      if exists (
        select 1
        from public.product_variants variant
        where variant.product_id = v_target.product_id
          and variant.store_id = v_target.store_id
          and variant.status = 'active'
          and not exists (
            select 1
            from public.digital_product_assets asset
            join public.digital_product_asset_versions version
              on version.asset_id = asset.id
             and version.product_id = asset.product_id
             and version.store_id = asset.store_id
            where asset.product_id = v_target.product_id
              and asset.store_id = v_target.store_id
              and asset.active
              and (
                asset.product_variant_id is null
                or asset.product_variant_id = variant.id
              )
              and version.status = 'ready'
              and version.retired_at is null
          )
      ) then
        raise exception using
          errcode = '23514',
          message = 'Active digital product is not ready';
      end if;
    elsif not exists (
      select 1
      from public.digital_product_assets asset
      join public.digital_product_asset_versions version
        on version.asset_id = asset.id
       and version.product_id = asset.product_id
       and version.store_id = asset.store_id
      where asset.product_id = v_target.product_id
        and asset.store_id = v_target.store_id
        and asset.product_variant_id is null
        and asset.active
        and version.status = 'ready'
        and version.retired_at is null
    ) then
      raise exception using
        errcode = '23514',
        message = 'Active digital product is not ready';
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function public.enforce_active_digital_product_readiness()
from public, anon, authenticated;
