-- Fulfillment belongs to what a buyer actually buys.
--
-- A painting can be sold as a download, as a print in the post, and as the
-- original canvas - one product, three variants, three different ways of
-- getting it to the buyer. Until now a product was digital or physical as a
-- whole, so that store had to be three separate products.
--
-- products.product_type stays the product's default and still answers "does
-- this product involve digital delivery at all", which is what the asset,
-- rights, and publishing gates ask. product_variants.fulfillment_type overrides
-- it for one variant, and that is what checkout, carts, and delivery read,
-- because those act on a line rather than on a product. Null means inherit, so
-- every existing variant keeps behaving exactly as it does today.

alter table public.product_variants
  add column if not exists fulfillment_type text
  check (fulfillment_type is null or fulfillment_type in ('physical', 'digital'));

comment on column public.product_variants.fulfillment_type is
  'How this variant reaches the buyer. Null inherits products.product_type.';

create index if not exists product_variants_fulfillment_type_idx
  on public.product_variants (product_id)
  where fulfillment_type is not null;

create or replace function public.create_or_reuse_digital_checkout_manifest(
  p_checkout_session_id uuid,
  p_store_id uuid,
  p_items jsonb,
  p_consent_version text,
  p_consent_accepted_at timestamptz,
  p_license_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_checkout public.storefront_checkout_sessions%rowtype;
  v_existing public.digital_purchase_manifests%rowtype;
  v_manifest_id uuid;
  v_request_fingerprint text;
  v_item record;
  v_asset record;
  v_product_type text;
  v_product_status text;
  v_rights_affirmed_at timestamptz;
  v_variant_status text;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_applicable_count integer;
  v_digital_line_count integer := 0;
  v_sort_order integer := 0;
begin
  if p_checkout_session_id is null or p_store_id is null then
    raise exception 'Digital checkout manifest is unavailable';
  end if;
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 100
  then
    raise exception 'Digital checkout manifest items are invalid';
  end if;
  if coalesce(char_length(trim(p_consent_version)), 0) = 0
     or p_consent_accepted_at is null
     or coalesce(char_length(trim(p_license_version)), 0) = 0
  then
    raise exception 'Digital checkout consent is invalid';
  end if;

  -- Participate in the catalog mutation protocol before locking catalog rows.
  perform public.acquire_digital_readiness_mutation_lock();

  select * into v_checkout
  from public.storefront_checkout_sessions checkout
  where checkout.id = p_checkout_session_id
    and checkout.store_id = p_store_id
  for update;

  if not found or v_checkout.status <> 'pending' then
    raise exception 'Digital checkout manifest is unavailable';
  end if;
  if v_checkout.items is distinct from p_items
     or v_checkout.digital_consent_version is distinct from p_consent_version
     or v_checkout.digital_consent_accepted_at is distinct from p_consent_accepted_at
     or v_checkout.digital_license_version is distinct from p_license_version
  then
    raise exception 'Digital checkout manifest fingerprint does not match the checkout';
  end if;

  v_request_fingerprint := encode(
    sha256(
      convert_to(
        jsonb_build_object(
          'checkoutSessionId', p_checkout_session_id,
          'storeId', p_store_id,
          'items', p_items,
          'consentVersion', p_consent_version,
          'consentAcceptedAt', p_consent_accepted_at,
          'licenseVersion', p_license_version
        )::text,
        'UTF8'
      )
    ),
    'hex'
  );

  select * into v_existing
  from public.digital_purchase_manifests manifest
  where manifest.checkout_session_id = p_checkout_session_id;

  if found then
    if v_existing.store_id <> p_store_id
       or v_existing.request_fingerprint_sha256 is distinct from v_request_fingerprint
       or v_checkout.digital_manifest_id is distinct from v_existing.id
    then
      raise exception 'Digital checkout manifest fingerprint conflict';
    end if;
    return public.digital_purchase_manifest_snapshot(v_existing.id);
  end if;

  -- Duplicate selected variants would make order-item attachment ambiguous.
  if exists (
    select 1
    from (
      select nullif(item.value ->> 'variantId', '')::uuid as variant_id
      from jsonb_array_elements(p_items) item(value)
    ) parsed
    group by parsed.variant_id
    having parsed.variant_id is null or count(*) > 1
  ) then
    raise exception 'Digital checkout manifest items are ambiguous';
  end if;

  insert into public.digital_purchase_manifests(
    store_id,
    checkout_session_id,
    consent_version,
    license_version,
    request_fingerprint_sha256
  ) values (
    p_store_id,
    p_checkout_session_id,
    p_consent_version,
    p_license_version,
    v_request_fingerprint
  )
  returning id into v_manifest_id;

  for v_item in
    select item.value, item.ordinality
    from jsonb_array_elements(p_items) with ordinality item(value, ordinality)
    order by item.ordinality
  loop
    begin
      v_product_id := nullif(v_item.value ->> 'productId', '')::uuid;
      v_variant_id := nullif(v_item.value ->> 'variantId', '')::uuid;
      v_quantity := (v_item.value ->> 'quantity')::integer;
    exception when others then
      raise exception 'Digital checkout manifest items are invalid';
    end;

    if v_product_id is null
       or v_variant_id is null
       or v_quantity is null
       or v_quantity <= 0
    then
      raise exception 'Digital checkout manifest items are invalid';
    end if;

    select
      coalesce(variant.fulfillment_type, product.product_type),
      product.status,
      product.digital_rights_affirmed_at,
      variant.status
    into
      v_product_type,
      v_product_status,
      v_rights_affirmed_at,
      v_variant_status
    from public.product_variants variant
    join public.products product
      on product.id = variant.product_id
     and product.store_id = variant.store_id
    where variant.id = v_variant_id
      and variant.product_id = v_product_id
      and variant.store_id = p_store_id
    for share of product, variant;

    if not found
       or v_product_status <> 'active'
       or v_variant_status <> 'active'
    then
      raise exception 'Digital checkout selection is unavailable';
    end if;

    if v_product_type <> 'digital' then
      continue;
    end if;

    if v_quantity <> 1 or v_rights_affirmed_at is null then
      raise exception 'Digital checkout bundle is not ready';
    end if;
    if not exists (
      select 1
      from public.digital_product_previews preview
      where preview.product_id = v_product_id
        and preview.store_id = p_store_id
        and preview.status = 'ready'
        and nullif(trim(preview.public_preview_path), '') is not null
    ) then
      raise exception 'Digital checkout bundle is not ready';
    end if;

    v_digital_line_count := v_digital_line_count + 1;
    v_applicable_count := 0;

    for v_asset in
      select
        asset.id as asset_id,
        version.id as asset_version_id,
        version.customer_filename,
        version.mime_type,
        version.byte_size,
        version.checksum_sha256,
        asset.label
      from public.digital_product_assets asset
      join lateral (
        select candidate.*
        from public.digital_product_asset_versions candidate
        where candidate.asset_id = asset.id
          and candidate.product_id = asset.product_id
          and candidate.store_id = asset.store_id
          and candidate.status = 'ready'
          and candidate.retired_at is null
        order by candidate.version_number desc, candidate.created_at desc, candidate.id desc
        limit 1
      ) version on true
      where asset.product_id = v_product_id
        and asset.store_id = p_store_id
        and asset.active = true
        and (
          asset.product_variant_id is null
          or asset.product_variant_id = v_variant_id
        )
      order by asset.sort_order, asset.id
    loop
      insert into public.digital_purchase_manifest_items(
        manifest_id,
        store_id,
        product_id,
        product_variant_id,
        asset_id,
        asset_version_id,
        customer_filename,
        mime_type,
        byte_size,
        checksum_sha256,
        label,
        sort_order
      ) values (
        v_manifest_id,
        p_store_id,
        v_product_id,
        v_variant_id,
        v_asset.asset_id,
        v_asset.asset_version_id,
        v_asset.customer_filename,
        v_asset.mime_type,
        v_asset.byte_size,
        v_asset.checksum_sha256,
        v_asset.label,
        v_sort_order
      );
      v_sort_order := v_sort_order + 1;
      v_applicable_count := v_applicable_count + 1;
    end loop;

    if v_applicable_count = 0 then
      raise exception 'Digital checkout bundle is not ready';
    end if;
  end loop;

  if v_digital_line_count = 0 then
    raise exception 'Digital checkout contains no digital items';
  end if;

  update public.storefront_checkout_sessions
  set digital_manifest_id = v_manifest_id
  where id = p_checkout_session_id
    and store_id = p_store_id;

  return public.digital_purchase_manifest_snapshot(v_manifest_id);
end;
$$;

create or replace function public.lock_digital_checkout_manifest(
  p_manifest_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_manifest public.digital_purchase_manifests%rowtype;
  v_checkout public.storefront_checkout_sessions%rowtype;
  v_manifest_item public.digital_purchase_manifest_items%rowtype;
  v_order_item_id uuid;
  v_order_item_count integer;
begin
  select * into v_manifest
  from public.digital_purchase_manifests manifest
  where manifest.id = p_manifest_id
  for update;

  if not found then
    raise exception 'Digital checkout manifest is unavailable';
  end if;

  select * into v_checkout
  from public.storefront_checkout_sessions checkout
  where checkout.id = v_manifest.checkout_session_id
    and checkout.store_id = v_manifest.store_id
    and checkout.digital_manifest_id = v_manifest.id
  for update;

  if not found then
    raise exception 'Digital checkout manifest binding is unavailable';
  end if;
  if v_checkout.order_id is not null and v_checkout.order_id <> p_order_id then
    raise exception 'Digital checkout manifest is already bound to another order';
  end if;
  if not exists (
    select 1
    from public.orders placed_order
    where placed_order.id = p_order_id
      and placed_order.store_id = v_manifest.store_id
  ) then
    raise exception 'Digital checkout order is unavailable';
  end if;

  if v_manifest.status = 'locked' then
    if v_manifest.order_id <> p_order_id then
      raise exception 'Digital checkout manifest is already locked to another order';
    end if;
    return public.digital_purchase_manifest_snapshot(v_manifest.id);
  end if;

  update public.digital_purchase_manifests
  set order_id = p_order_id
  where id = v_manifest.id;

  for v_manifest_item in
    select *
    from public.digital_purchase_manifest_items item
    where item.manifest_id = v_manifest.id
    order by item.sort_order, item.id
    for update
  loop
    select count(*)
    into v_order_item_count
    from public.order_items order_item
    where order_item.order_id = p_order_id
      and order_item.store_id = v_manifest.store_id
      and order_item.product_id = v_manifest_item.product_id
      and order_item.product_variant_id is not distinct from v_manifest_item.product_variant_id;

    if v_order_item_count <> 1 then
      raise exception 'Digital checkout order item mapping is ambiguous';
    end if;

    select order_item.id
    into v_order_item_id
    from public.order_items order_item
    where order_item.order_id = p_order_id
      and order_item.store_id = v_manifest.store_id
      and order_item.product_id = v_manifest_item.product_id
      and order_item.product_variant_id is not distinct from v_manifest_item.product_variant_id
    order by order_item.id
    limit 1;

    update public.digital_purchase_manifest_items
    set order_id = p_order_id,
        order_item_id = v_order_item_id
    where id = v_manifest_item.id;
  end loop;

  if exists (
    select 1
    from public.order_items order_item
    where order_item.order_id = p_order_id
      and order_item.store_id = v_manifest.store_id
      and order_item.product_type = 'digital'
      and not exists (
        select 1
        from public.digital_purchase_manifest_items manifest_item
        where manifest_item.manifest_id = v_manifest.id
          and manifest_item.order_item_id = order_item.id
      )
  ) then
    raise exception 'Digital checkout manifest does not cover every digital order item';
  end if;

  update public.digital_purchase_manifests
  set status = 'locked',
      locked_at = now()
  where id = v_manifest.id;

  update public.storefront_checkout_sessions
  set order_id = p_order_id
  where id = v_checkout.id;

  return public.digital_purchase_manifest_snapshot(v_manifest.id);
end;
$$;

create or replace function public.repair_authenticated_customer_cart(
  p_cart_id uuid
)
returns table (
  product_id uuid,
  product_variant_id uuid,
  quantity integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store_id uuid;
  v_normalized jsonb;
  v_raw_count integer;
  v_requires_repair boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select cart.store_id into v_store_id
  from public.customer_carts cart
  where cart.id = p_cart_id
    and cart.user_id = auth.uid()
    and cart.status = 'active'
  for update;
  if not found then
    return;
  end if;

  perform 1
  from public.customer_cart_items item
  where item.cart_id = p_cart_id
  order by item.id
  for update;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'productId', normalized.product_id,
        'variantId', normalized.product_variant_id,
        'quantity', normalized.quantity,
        'unitPriceCents', normalized.unit_price_snapshot_cents
      ) order by normalized.product_id, normalized.product_variant_id
    ),
    '[]'::jsonb
  ) into v_normalized
  from (
    select
      product.id as product_id,
      variant.id as product_variant_id,
      case
        when coalesce(variant.fulfillment_type, product.product_type) = 'digital' then 1
        else least(99, sum(item.quantity))::integer
      end as quantity,
      variant.price_cents as unit_price_snapshot_cents
    from public.customer_cart_items item
    join public.products product
      on product.id = item.product_id
     and product.store_id = v_store_id
     and product.status = 'active'
    join public.product_variants variant
      on variant.id = item.product_variant_id
     and variant.product_id = product.id
     and variant.store_id = product.store_id
     and variant.status = 'active'
    where item.cart_id = p_cart_id
    group by product.id, variant.id, product.product_type, variant.fulfillment_type, variant.price_cents
  ) normalized;

  select count(*) into v_raw_count
  from public.customer_cart_items item
  where item.cart_id = p_cart_id;

  v_requires_repair := v_raw_count <> jsonb_array_length(v_normalized)
    or exists (
      select 1
      from public.customer_cart_items item
      join public.products product
        on product.id = item.product_id
       and product.store_id = v_store_id
       and product.status = 'active'
      join public.product_variants variant
        on variant.id = item.product_variant_id
       and variant.product_id = product.id
       and variant.store_id = product.store_id
       and variant.status = 'active'
      where item.cart_id = p_cart_id
        and (
          item.quantity is distinct from case when coalesce(variant.fulfillment_type, product.product_type) = 'digital' then 1 else item.quantity end
          or item.unit_price_snapshot_cents is distinct from variant.price_cents
        )
    );

  if v_requires_repair then
    delete from public.customer_cart_items item
    where item.cart_id = p_cart_id;

    insert into public.customer_cart_items(
      cart_id,
      product_id,
      product_variant_id,
      quantity,
      unit_price_snapshot_cents
    )
    select
      p_cart_id,
      (entry ->> 'productId')::uuid,
      (entry ->> 'variantId')::uuid,
      (entry ->> 'quantity')::integer,
      (entry ->> 'unitPriceCents')::integer
    from jsonb_array_elements(v_normalized) entry;
  end if;

  return query
  select
    (entry ->> 'productId')::uuid,
    (entry ->> 'variantId')::uuid,
    (entry ->> 'quantity')::integer
  from jsonb_array_elements(v_normalized) entry;
end;
$$;

create or replace function public.replace_authenticated_customer_cart_items(
  p_cart_id uuid,
  p_items jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_catalog_product_type text;
  v_catalog_price_cents integer;
  v_seen_keys text[] := array[]::text[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Cart items must be an array';
  end if;

  select cart.store_id into v_store_id
  from public.customer_carts cart
  where cart.id = p_cart_id
    and cart.user_id = auth.uid()
    and cart.status = 'active'
  for update;
  if not found then
    return false;
  end if;

  perform 1
  from public.customer_cart_items item
  where item.cart_id = p_cart_id
  order by item.id
  for update;

  delete from public.customer_cart_items item
  where item.cart_id = p_cart_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
      v_variant_id := nullif(v_item ->> 'product_variant_id', '')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Cart item is invalid';
    end;

    if v_product_id is null
       or v_variant_id is null
       or v_quantity is null
       or v_quantity < 1
       or v_quantity > 99
       or (v_product_id::text || ':' || v_variant_id::text) = any(v_seen_keys)
    then
      raise exception 'Cart item is invalid';
    end if;

    select product.product_type, variant.price_cents
    into v_catalog_product_type, v_catalog_price_cents
    from public.products product
    join public.product_variants variant
      on variant.id = v_variant_id
     and variant.product_id = product.id
     and variant.store_id = product.store_id
     and variant.status = 'active'
    where product.id = v_product_id
      and product.store_id = v_store_id
      and product.status = 'active';
    if not found then
      raise exception 'Cart item is unavailable';
    end if;

    insert into public.customer_cart_items(
      cart_id,
      product_id,
      product_variant_id,
      quantity,
      unit_price_snapshot_cents
    ) values (
      p_cart_id,
      v_product_id,
      v_variant_id,
      case when v_catalog_product_type = 'digital' then 1 else v_quantity end,
      v_catalog_price_cents
    );
    v_seen_keys := array_append(
      v_seen_keys,
      v_product_id::text || ':' || v_variant_id::text
    );
  end loop;

  return true;
end;
$$;
