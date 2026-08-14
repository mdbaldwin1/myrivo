-- Apply digital catalog changes and publish readiness checks as one transaction.
-- The service role is the only caller; tenant ownership is carried in every predicate.

create or replace function public.apply_digital_product_catalog_update(
  p_store_id uuid,
  p_product_id uuid,
  p_actor_user_id uuid,
  p_product_updates jsonb,
  p_variants jsonb default null,
  p_variant_tier_levels jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_next_product_type text;
  v_next_status text;
  v_next_rights_at timestamptz;
  v_active_variant_ids uuid[] := '{}'::uuid[];
  v_variant_id uuid;
  v_variant jsonb;
  v_stale_variant_ids uuid[] := '{}'::uuid[];
  v_reasons text[] := '{}'::text[];
  v_allowed_update_keys constant text[] := array[
    'title', 'description', 'slug', 'sku', 'image_urls', 'image_alt_text',
    'seo_title', 'seo_description', 'is_featured', 'price_cents',
    'inventory_qty', 'status', 'product_type',
    'digital_rights_affirmed_at', 'digital_rights_affirmed_by_user_id'
  ];
begin
  if p_store_id is null or p_product_id is null or p_actor_user_id is null
    or p_product_updates is null or jsonb_typeof(p_product_updates) <> 'object'
    or exists (
      select 1 from jsonb_object_keys(p_product_updates) key
      where not (key = any(v_allowed_update_keys))
    )
  then
    raise exception 'Invalid digital catalog update';
  end if;

  if p_variants is not null and (
    jsonb_typeof(p_variants) <> 'array'
    or jsonb_array_length(p_variants) > 500
  ) then
    raise exception 'Invalid digital catalog variants';
  end if;
  if p_variant_tier_levels is not null and (
    jsonb_typeof(p_variant_tier_levels) <> 'array'
    or jsonb_array_length(p_variant_tier_levels) > 2
  ) then
    raise exception 'Invalid digital catalog option levels';
  end if;

  select * into v_product
  from public.products p
  where p.id = p_product_id and p.store_id = p_store_id
  for update;
  if not found then
    return jsonb_build_object(
      'applied', false,
      'code', 'product_unavailable',
      'reasons', '[]'::jsonb
    );
  end if;

  if to_regclass('public.store_memberships') is not null
    and not exists (
      select 1 from public.stores store
      where store.id = p_store_id and store.owner_user_id = p_actor_user_id
    )
    and not exists (
      select 1 from public.store_memberships membership
      where membership.store_id = p_store_id
        and membership.user_id = p_actor_user_id
        and membership.status = 'active'
        and membership.role in ('owner', 'admin', 'staff')
    )
  then
    return jsonb_build_object(
      'applied', false,
      'code', 'product_unavailable',
      'reasons', '[]'::jsonb
    );
  end if;

  v_next_product_type := case
    when p_product_updates ? 'product_type'
      then p_product_updates ->> 'product_type'
    else v_product.product_type
  end;
  v_next_status := case
    when p_product_updates ? 'status' then p_product_updates ->> 'status'
    else v_product.status
  end;
  v_next_rights_at := case
    when v_next_product_type = 'physical' then null
    when p_product_updates ? 'digital_rights_affirmed_at'
      then nullif(p_product_updates ->> 'digital_rights_affirmed_at', '')::timestamptz
    else v_product.digital_rights_affirmed_at
  end;

  if v_next_product_type not in ('physical', 'digital')
    or v_next_status not in ('draft', 'active', 'archived')
  then
    raise exception 'Invalid digital catalog state';
  end if;

  if v_product.product_type <> v_next_product_type
    and exists (
      select 1 from public.order_items oi
      where oi.product_id = p_product_id and oi.store_id = p_store_id
    )
  then
    return jsonb_build_object(
      'applied', false,
      'code', 'product_type_has_order_history',
      'reasons', '[]'::jsonb
    );
  end if;

  if v_product.product_type = 'physical'
    and v_next_product_type = 'digital'
    and (
      not (p_product_updates ? 'digital_rights_affirmed_at')
      or v_next_rights_at is null
      or not (p_product_updates ? 'digital_rights_affirmed_by_user_id')
      or nullif(p_product_updates ->> 'digital_rights_affirmed_by_user_id', '')::uuid
        is distinct from p_actor_user_id
    )
  then
    return jsonb_build_object(
      'applied', false,
      'code', 'fresh_rights_affirmation_required',
      'reasons', jsonb_build_array('rights_missing')
    );
  end if;

  if p_variants is null then
    select coalesce(array_agg(pv.id order by pv.sort_order, pv.created_at), '{}'::uuid[])
    into v_active_variant_ids
    from public.product_variants pv
    where pv.store_id = p_store_id and pv.product_id = p_product_id
      and pv.status = 'active';
  else
    if exists (
      select 1
      from jsonb_array_elements(p_variants) item
      where jsonb_typeof(item) <> 'object'
        or not (item ? 'id')
        or nullif(item ->> 'id', '') is null
        or item ->> 'status' not in ('active', 'archived')
    ) then
      raise exception 'Invalid digital catalog variant';
    end if;

    if (
      select count(*) <> count(distinct (item ->> 'id')::uuid)
      from jsonb_array_elements(p_variants) item
    ) then
      raise exception 'Duplicate digital catalog variant';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_variants) item
      join public.product_variants pv on pv.id = (item ->> 'id')::uuid
      where pv.store_id <> p_store_id or pv.product_id <> p_product_id
    ) then
      raise exception 'Digital catalog variant unavailable';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_variants) item
      join public.product_variants pv
        on pv.id = (item ->> 'id')::uuid
       and pv.store_id = p_store_id
       and pv.product_id = p_product_id
      where exists (
        select 1 from public.order_items oi
        where oi.store_id = p_store_id
          and oi.product_id = p_product_id
          and oi.product_variant_id = pv.id
      ) and (
        coalesce(trim(item ->> 'sku'), '') <> coalesce(trim(pv.sku), '')
        or coalesce(item -> 'option_values', '{}'::jsonb) <> pv.option_values
      )
    ) then
      raise exception 'Ordered variants cannot change SKU or option values';
    end if;

    select coalesce(array_agg((item ->> 'id')::uuid order by ordinality), '{}'::uuid[])
    into v_active_variant_ids
    from jsonb_array_elements(p_variants) with ordinality proposed(item, ordinality)
    where item ->> 'status' = 'active';

    select coalesce(array_agg(pv.id), '{}'::uuid[])
    into v_stale_variant_ids
    from public.product_variants pv
    where pv.store_id = p_store_id and pv.product_id = p_product_id
      and not exists (
        select 1 from jsonb_array_elements(p_variants) item
        where (item ->> 'id')::uuid = pv.id
      );

    if cardinality(v_stale_variant_ids) > 0 and exists (
      select 1 from public.order_items oi
      where oi.store_id = p_store_id and oi.product_id = p_product_id
        and oi.product_variant_id = any(v_stale_variant_ids)
    ) then
      raise exception 'Ordered variants cannot be deleted';
    end if;
  end if;

  -- Asset and preview lifecycle functions also lock this product row. This lock
  -- makes the readiness snapshot stable until this transaction commits.
  perform 1 from public.digital_product_previews preview
  where preview.product_id = p_product_id and preview.store_id = p_store_id
  for share;
  perform 1 from public.digital_product_assets asset
  where asset.product_id = p_product_id and asset.store_id = p_store_id
  for share;

  if v_next_product_type = 'digital' and v_next_status = 'active' then
    if v_next_rights_at is null then
      v_reasons := array_append(v_reasons, 'rights_missing');
    end if;
    if not exists (
      select 1 from public.digital_product_previews preview
      where preview.product_id = p_product_id
        and preview.store_id = p_store_id
        and preview.status = 'ready'
        and preview.public_preview_path is not null
    ) then
      v_reasons := array_append(v_reasons, 'preview_not_ready');
    end if;

    if cardinality(v_active_variant_ids) = 0 then
      if not exists (
        select 1
        from public.digital_product_assets asset
        join public.digital_product_asset_versions version
          on version.asset_id = asset.id
         and version.product_id = asset.product_id
         and version.store_id = asset.store_id
        where asset.product_id = p_product_id
          and asset.store_id = p_store_id
          and asset.product_variant_id is null
          and asset.active
          and version.status = 'ready'
          and version.retired_at is null
      ) then
        v_reasons := array_append(v_reasons, 'product_missing_file');
      end if;
    else
      foreach v_variant_id in array v_active_variant_ids loop
        if not exists (
          select 1
          from public.digital_product_assets asset
          join public.digital_product_asset_versions version
            on version.asset_id = asset.id
           and version.product_id = asset.product_id
           and version.store_id = asset.store_id
          where asset.product_id = p_product_id
            and asset.store_id = p_store_id
            and asset.active
            and (asset.product_variant_id is null or asset.product_variant_id = v_variant_id)
            and version.status = 'ready'
            and version.retired_at is null
        ) then
          v_reasons := array_append(v_reasons, 'variant_missing_file:' || v_variant_id::text);
        end if;
      end loop;
    end if;

    if cardinality(v_reasons) > 0 then
      return jsonb_build_object(
        'applied', false,
        'code', 'digital_product_not_ready',
        'reasons', to_jsonb(v_reasons)
      );
    end if;
  end if;

  if p_variants is not null then
    update public.product_variants pv
    set is_default = false
    where pv.store_id = p_store_id and pv.product_id = p_product_id;

    for v_variant in select value from jsonb_array_elements(p_variants) loop
      if exists (
        select 1 from public.product_variants pv
        where pv.id = (v_variant ->> 'id')::uuid
          and pv.store_id = p_store_id and pv.product_id = p_product_id
      ) then
        update public.product_variants pv
        set title = v_variant ->> 'title',
            sku = v_variant ->> 'sku',
            sku_mode = (v_variant ->> 'sku_mode'),
            image_urls = array(
              select jsonb_array_elements_text(coalesce(v_variant -> 'image_urls', '[]'::jsonb))
            ),
            group_image_urls = array(
              select jsonb_array_elements_text(coalesce(v_variant -> 'group_image_urls', '[]'::jsonb))
            ),
            option_values = coalesce(v_variant -> 'option_values', '{}'::jsonb),
            price_cents = (v_variant ->> 'price_cents')::integer,
            inventory_qty = (v_variant ->> 'inventory_qty')::integer,
            is_made_to_order = (v_variant ->> 'is_made_to_order')::boolean,
            is_default = (v_variant ->> 'is_default')::boolean,
            status = v_variant ->> 'status',
            sort_order = (v_variant ->> 'sort_order')::integer
        where pv.id = (v_variant ->> 'id')::uuid
          and pv.store_id = p_store_id and pv.product_id = p_product_id;
      else
        insert into public.product_variants(
          id, store_id, product_id, title, sku, sku_mode, image_urls,
          group_image_urls, option_values, price_cents, inventory_qty,
          is_made_to_order, is_default, status, sort_order
        ) values (
          (v_variant ->> 'id')::uuid, p_store_id, p_product_id,
          v_variant ->> 'title', v_variant ->> 'sku', v_variant ->> 'sku_mode',
          array(select jsonb_array_elements_text(coalesce(v_variant -> 'image_urls', '[]'::jsonb))),
          array(select jsonb_array_elements_text(coalesce(v_variant -> 'group_image_urls', '[]'::jsonb))),
          coalesce(v_variant -> 'option_values', '{}'::jsonb),
          (v_variant ->> 'price_cents')::integer,
          (v_variant ->> 'inventory_qty')::integer,
          (v_variant ->> 'is_made_to_order')::boolean,
          (v_variant ->> 'is_default')::boolean,
          v_variant ->> 'status',
          (v_variant ->> 'sort_order')::integer
        );
      end if;
    end loop;

    if cardinality(v_stale_variant_ids) > 0 then
      delete from public.product_variants pv
      where pv.store_id = p_store_id and pv.product_id = p_product_id
        and pv.id = any(v_stale_variant_ids);
    end if;

    delete from public.product_variant_option_values mapping
    using public.product_variants pv
    where mapping.variant_id = pv.id
      and pv.store_id = p_store_id and pv.product_id = p_product_id;
    delete from public.product_option_values value
    where value.store_id = p_store_id and value.product_id = p_product_id;
    delete from public.product_option_axes axis
    where axis.store_id = p_store_id and axis.product_id = p_product_id;

    with expanded as (
      select options.key as axis_name,
             variant_ordinality,
             option_ordinality
      from jsonb_array_elements(p_variants) with ordinality variants(item, variant_ordinality)
      cross join lateral jsonb_each_text(coalesce(item -> 'option_values', '{}'::jsonb))
        with ordinality options(key, value, option_ordinality)
      where trim(options.key) <> '' and trim(options.value) <> ''
    ),
    names as (
      select axis_name,
             min(variant_ordinality * 100 + option_ordinality) as encountered_order
      from expanded
      group by axis_name
    ),
    ranked as (
      select names.axis_name,
             row_number() over (
               order by coalesce(
                 (
                   select tier.ordinality
                   from jsonb_array_elements_text(coalesce(p_variant_tier_levels, '[]'::jsonb))
                     with ordinality tier(name, ordinality)
                   where lower(trim(tier.name)) = lower(trim(names.axis_name))
                   limit 1
                 ),
                 1000 + names.encountered_order
               ),
               names.encountered_order
             ) - 1 as sort_order
      from names
    )
    insert into public.product_option_axes(
      store_id, product_id, name, sort_order, is_required
    )
    select p_store_id, p_product_id, trim(axis_name), sort_order, true
    from ranked;

    with expanded as (
      select trim(options.key) as axis_name,
             trim(options.value) as option_value,
             variant_ordinality,
             option_ordinality
      from jsonb_array_elements(p_variants) with ordinality variants(item, variant_ordinality)
      cross join lateral jsonb_each_text(coalesce(item -> 'option_values', '{}'::jsonb))
        with ordinality options(key, value, option_ordinality)
      where trim(options.key) <> '' and trim(options.value) <> ''
    ),
    values_ranked as (
      select axis_name, option_value,
             row_number() over (
               partition by lower(axis_name)
               order by min(variant_ordinality * 100 + option_ordinality)
             ) - 1 as sort_order
      from expanded
      group by axis_name, option_value
    )
    insert into public.product_option_values(
      store_id, product_id, axis_id, value, sort_order, is_active
    )
    select p_store_id, p_product_id, axis.id,
           values_ranked.option_value, values_ranked.sort_order, true
    from values_ranked
    join public.product_option_axes axis
      on axis.store_id = p_store_id and axis.product_id = p_product_id
     and lower(axis.name) = lower(values_ranked.axis_name);

    insert into public.product_variant_option_values(variant_id, axis_id, value_id)
    select (variant.item ->> 'id')::uuid, axis.id, value.id
    from jsonb_array_elements(p_variants) variant(item)
    cross join lateral jsonb_each_text(coalesce(variant.item -> 'option_values', '{}'::jsonb)) options
    join public.product_option_axes axis
      on axis.store_id = p_store_id and axis.product_id = p_product_id
     and lower(axis.name) = lower(trim(options.key))
    join public.product_option_values value
      on value.axis_id = axis.id and lower(value.value) = lower(trim(options.value))
    where trim(options.key) <> '' and trim(options.value) <> '';
  end if;

  update public.products p
  set title = case when p_product_updates ? 'title' then p_product_updates ->> 'title' else p.title end,
      description = case when p_product_updates ? 'description' then p_product_updates ->> 'description' else p.description end,
      slug = case when p_product_updates ? 'slug' then p_product_updates ->> 'slug' else p.slug end,
      sku = case when p_product_updates ? 'sku' then p_product_updates ->> 'sku' else p.sku end,
      image_urls = case when p_product_updates ? 'image_urls'
        then array(select jsonb_array_elements_text(coalesce(p_product_updates -> 'image_urls', '[]'::jsonb)))
        else p.image_urls end,
      image_alt_text = case when p_product_updates ? 'image_alt_text' then p_product_updates ->> 'image_alt_text' else p.image_alt_text end,
      seo_title = case when p_product_updates ? 'seo_title' then p_product_updates ->> 'seo_title' else p.seo_title end,
      seo_description = case when p_product_updates ? 'seo_description' then p_product_updates ->> 'seo_description' else p.seo_description end,
      is_featured = case when p_product_updates ? 'is_featured' then (p_product_updates ->> 'is_featured')::boolean else p.is_featured end,
      price_cents = case when p_product_updates ? 'price_cents' then (p_product_updates ->> 'price_cents')::integer else p.price_cents end,
      inventory_qty = case when p_product_updates ? 'inventory_qty' then (p_product_updates ->> 'inventory_qty')::integer else p.inventory_qty end,
      status = v_next_status,
      product_type = v_next_product_type,
      digital_rights_affirmed_at = case
        when v_next_product_type = 'physical' then null
        else v_next_rights_at
      end,
      digital_rights_affirmed_by_user_id = case
        when v_next_product_type = 'physical' or v_next_rights_at is null then null
        when p_product_updates ? 'digital_rights_affirmed_by_user_id'
          then nullif(p_product_updates ->> 'digital_rights_affirmed_by_user_id', '')::uuid
        else p.digital_rights_affirmed_by_user_id
      end
  where p.id = p_product_id and p.store_id = p_store_id;

  return jsonb_build_object(
    'applied', true,
    'code', 'applied',
    'reasons', '[]'::jsonb
  );
end;
$$;

revoke all on function public.apply_digital_product_catalog_update(
  uuid, uuid, uuid, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_digital_product_catalog_update(
  uuid, uuid, uuid, jsonb, jsonb, jsonb
) to service_role;

update public.products
set digital_rights_affirmed_at = null,
    digital_rights_affirmed_by_user_id = null
where product_type = 'physical'
  and (
    digital_rights_affirmed_at is not null
    or digital_rights_affirmed_by_user_id is not null
  );

create or replace function public.enforce_product_type_conversion_safety()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.product_type is distinct from new.product_type then
    if exists (
      select 1 from public.order_items oi
      where oi.product_id = old.id and oi.store_id = old.store_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Products with order history cannot change fulfillment type';
    end if;

    if old.product_type = 'physical' and new.product_type = 'digital'
      and (
        new.digital_rights_affirmed_at is null
        or new.digital_rights_affirmed_by_user_id is null
      )
    then
      raise exception using
        errcode = '23514',
        message = 'Fresh digital rights affirmation is required';
    end if;
  end if;

  if new.product_type = 'physical' then
    new.digital_rights_affirmed_at := null;
    new.digital_rights_affirmed_by_user_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_product_type_conversion_safety on public.products;
create trigger enforce_product_type_conversion_safety
before insert or update of product_type, digital_rights_affirmed_at,
  digital_rights_affirmed_by_user_id
on public.products
for each row execute function public.enforce_product_type_conversion_safety();

revoke all on function public.enforce_product_type_conversion_safety()
from public, anon, authenticated;

-- Keep the invariant true after publishing as catalog assets, versions,
-- previews, variants, rights, and product status change. Deferred checking
-- permits the transactional RPC to make coordinated multi-table changes.
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

  select * into v_product
  from public.products p
  where p.id = v_product_id and p.store_id = v_store_id;
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

-- The guarded block keeps this forward migration executable against the
-- intentionally minimal upgrade-contract fixture while installing every
-- trigger in the complete application schema.
do $$
declare
  v_table text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'status'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_variants' and column_name = 'status'
  ) then
    foreach v_table in array array[
      'products',
      'product_variants',
      'digital_product_assets',
      'digital_product_asset_versions',
      'digital_product_previews'
    ] loop
      execute format(
        'drop trigger if exists enforce_active_digital_product_readiness on public.%I',
        v_table
      );
      execute format(
        'create constraint trigger enforce_active_digital_product_readiness
         after insert or update or delete on public.%I
         deferrable initially deferred
         for each row execute function public.enforce_active_digital_product_readiness()',
        v_table
      );
    end loop;
  end if;
end;
$$;

revoke all on function public.enforce_active_digital_product_readiness()
from public, anon, authenticated;
