-- Serialize readiness-affecting child mutations with publication. The first
-- migration locked both the product and child rows while publishing. A raw
-- child mutation holds its child row before its deferred constraint trigger,
-- so retaining those child locks would introduce a product/child lock-order
-- cycle once the trigger also locks the product. The product lock is the sole
-- serialization point; supported lifecycle RPCs already take it first.

do $migration$
declare
  v_function_definition text;
  v_child_lock_block constant text := $block$  -- Asset and preview lifecycle functions also lock this product row. This lock
  -- makes the readiness snapshot stable until this transaction commits.
  perform 1 from public.digital_product_previews preview
  where preview.product_id = p_product_id and preview.store_id = p_store_id
  for share;
  perform 1 from public.digital_product_assets asset
  where asset.product_id = p_product_id and asset.store_id = p_store_id
  for share;

$block$;
begin
  select pg_get_functiondef(
    'public.apply_digital_product_catalog_update(uuid,uuid,uuid,jsonb,jsonb,jsonb)'::regprocedure
  ) into v_function_definition;

  if strpos(v_function_definition, v_child_lock_block) = 0 then
    raise exception 'Unable to remove obsolete digital publishing child locks';
  end if;

  execute replace(
    v_function_definition,
    v_child_lock_block,
    $replacement$  -- The product row lock above is the transaction-wide serialization point.

$replacement$
  );
end;
$migration$;

create or replace function public.enforce_active_digital_product_readiness()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := to_jsonb(old);
  v_product_id uuid;
  v_store_id uuid;
  v_product public.products%rowtype;
begin
  v_product_id := coalesce(
    nullif(v_new ->> 'product_id', '')::uuid,
    nullif(v_new ->> 'id', '')::uuid,
    nullif(v_old ->> 'product_id', '')::uuid,
    nullif(v_old ->> 'id', '')::uuid
  );
  v_store_id := coalesce(
    nullif(v_new ->> 'store_id', '')::uuid,
    nullif(v_old ->> 'store_id', '')::uuid
  );
  if v_product_id is null or v_store_id is null then
    return null;
  end if;

  -- FOR SHARE conflicts with both explicit FOR UPDATE publication locks and
  -- ordinary non-key product updates. The lock remains held through commit,
  -- so either this transaction validates first and publication observes its
  -- child changes, or publication commits first and this trigger revalidates
  -- against the newly active product.
  select * into v_product
  from public.products p
  where p.id = v_product_id and p.store_id = v_store_id
  for share;
  if not found or v_product.product_type <> 'digital' or v_product.status <> 'active' then
    return null;
  end if;

  if v_product.digital_rights_affirmed_at is null
    or not exists (
      select 1 from public.digital_product_previews preview
      where preview.product_id = v_product_id
        and preview.store_id = v_store_id
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
    where variant.product_id = v_product_id
      and variant.store_id = v_store_id
      and variant.status = 'active'
  ) then
    if exists (
      select 1
      from public.product_variants variant
      where variant.product_id = v_product_id
        and variant.store_id = v_store_id
        and variant.status = 'active'
        and not exists (
          select 1
          from public.digital_product_assets asset
          join public.digital_product_asset_versions version
            on version.asset_id = asset.id
           and version.product_id = asset.product_id
           and version.store_id = asset.store_id
          where asset.product_id = v_product_id
            and asset.store_id = v_store_id
            and asset.active
            and (asset.product_variant_id is null or asset.product_variant_id = variant.id)
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
    where asset.product_id = v_product_id
      and asset.store_id = v_store_id
      and asset.product_variant_id is null
      and asset.active
      and version.status = 'ready'
      and version.retired_at is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'Active digital product is not ready';
  end if;

  return null;
end;
$$;

revoke all on function public.enforce_active_digital_product_readiness()
from public, anon, authenticated;
