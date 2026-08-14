-- Capture the exact digital bundle before external payment creation. Checkout
-- attempts and catalog resolution are serialized in Postgres so retries cannot
-- observe or manufacture a different asset-version snapshot.

alter table public.digital_purchase_manifests
  add column if not exists request_fingerprint_sha256 text;

update public.digital_purchase_manifests
set request_fingerprint_sha256 = encode(
  sha256(
    convert_to(
      jsonb_build_object(
        'checkoutSessionId', checkout_session_id,
        'storeId', store_id,
        'consentVersion', consent_version,
        'licenseVersion', license_version
      )::text,
      'UTF8'
    )
  ),
  'hex'
)
where checkout_session_id is not null
  and request_fingerprint_sha256 is null;

alter table public.digital_purchase_manifests
  add constraint digital_purchase_manifests_request_fingerprint_check
    check (
      request_fingerprint_sha256 is null
      or request_fingerprint_sha256 ~ '^[a-f0-9]{64}$'
    ),
  add constraint digital_purchase_manifests_checkout_fingerprint_required
    check (
      checkout_session_id is null
      or request_fingerprint_sha256 is not null
    );

alter table public.digital_purchase_manifest_items
  drop constraint if exists digital_purchase_manifest_items_manifest_version_key,
  add constraint digital_purchase_manifest_items_manifest_variant_version_key
    unique nulls not distinct (
      manifest_id,
      product_variant_id,
      asset_version_id
    );

alter table public.storefront_checkout_sessions
  add column if not exists digital_manifest_id uuid;

alter table public.storefront_checkout_sessions
  add constraint storefront_checkout_sessions_digital_manifest_store_fk
    foreign key (digital_manifest_id, store_id)
    references public.digital_purchase_manifests(id, store_id)
    on delete restrict;

create unique index if not exists storefront_checkout_sessions_digital_manifest_unique
  on public.storefront_checkout_sessions(digital_manifest_id)
  where digital_manifest_id is not null;

create or replace function public.enforce_storefront_checkout_manifest_binding()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and old.digital_manifest_id is not null
     and new.digital_manifest_id is distinct from old.digital_manifest_id
  then
    raise exception 'A checkout manifest binding is immutable';
  end if;

  if new.digital_manifest_id is not null
     and not exists (
       select 1
       from public.digital_purchase_manifests manifest
       where manifest.id = new.digital_manifest_id
         and manifest.store_id = new.store_id
         and manifest.checkout_session_id = new.id
     )
  then
    raise exception 'Checkout manifest binding does not match the checkout';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_storefront_checkout_manifest_binding
on public.storefront_checkout_sessions;
create trigger enforce_storefront_checkout_manifest_binding
before insert or update of digital_manifest_id, store_id
on public.storefront_checkout_sessions
for each row execute function public.enforce_storefront_checkout_manifest_binding();

create or replace function public.enforce_digital_manifest_snapshot_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_repair_allowed boolean :=
    current_user = 'postgres'
    and current_setting('myrivo.digital_manifest_repair', true) = 'on';
begin
  if v_repair_allowed then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Digital purchase snapshots cannot be deleted';
  end if;

  if tg_table_name = 'digital_purchase_manifests' then
    if new.store_id is distinct from old.store_id
       or new.checkout_session_id is distinct from old.checkout_session_id
       or new.consent_version is distinct from old.consent_version
       or new.license_version is distinct from old.license_version
       or new.request_fingerprint_sha256 is distinct from old.request_fingerprint_sha256
       or new.created_at is distinct from old.created_at
    then
      raise exception 'Digital purchase manifest identity is immutable';
    end if;
    return new;
  end if;

  if new.manifest_id is distinct from old.manifest_id
     or new.store_id is distinct from old.store_id
     or new.product_id is distinct from old.product_id
     or new.product_variant_id is distinct from old.product_variant_id
     or new.asset_id is distinct from old.asset_id
     or new.asset_version_id is distinct from old.asset_version_id
     or new.customer_filename is distinct from old.customer_filename
     or new.mime_type is distinct from old.mime_type
     or new.byte_size is distinct from old.byte_size
     or new.checksum_sha256 is distinct from old.checksum_sha256
     or new.label is distinct from old.label
     or new.sort_order is distinct from old.sort_order
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Digital purchase manifest item snapshot is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists digital_purchase_manifests_snapshot_identity
on public.digital_purchase_manifests;
create trigger digital_purchase_manifests_snapshot_identity
before update or delete on public.digital_purchase_manifests
for each row execute function public.enforce_digital_manifest_snapshot_identity();

drop trigger if exists digital_purchase_manifest_items_snapshot_identity
on public.digital_purchase_manifest_items;
create trigger digital_purchase_manifest_items_snapshot_identity
before update or delete on public.digital_purchase_manifest_items
for each row execute function public.enforce_digital_manifest_snapshot_identity();

create or replace function public.digital_purchase_manifest_snapshot(
  p_manifest_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'manifestId', manifest.id,
    'orderId', manifest.order_id,
    'checkoutSessionId', manifest.checkout_session_id,
    'storeId', manifest.store_id,
    'consentVersion', manifest.consent_version,
    'licenseVersion', manifest.license_version,
    'createdAt', manifest.created_at,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'orderItemId', item.order_item_id,
            'productId', item.product_id,
            'productVariantId', item.product_variant_id,
            'assetId', item.asset_id,
            'assetVersionId', item.asset_version_id,
            'customerFilename', item.customer_filename,
            'mimeType', item.mime_type,
            'byteSize', item.byte_size,
            'checksumSha256', item.checksum_sha256,
            'label', item.label,
            'sortOrder', item.sort_order
          )
          order by item.sort_order, item.id
        )
        from public.digital_purchase_manifest_items item
        where item.manifest_id = manifest.id
      ),
      '[]'::jsonb
    )
  )
  from public.digital_purchase_manifests manifest
  where manifest.id = p_manifest_id
$$;

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
      product.product_type,
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
    join public.products product
      on product.id = order_item.product_id
     and product.store_id = order_item.store_id
    where order_item.order_id = p_order_id
      and order_item.store_id = v_manifest.store_id
      and product.product_type = 'digital'
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

create or replace function public.stub_checkout_create_paid_order_with_manifest(
  p_store_slug text,
  p_customer_email text,
  p_customer_user_id uuid default null,
  p_items jsonb default '[]'::jsonb,
  p_stub_payment_ref text default null,
  p_discount_cents integer default 0,
  p_promo_code text default null,
  p_checkout_session_id uuid default null,
  p_digital_manifest_id uuid default null
)
returns table (
  order_id uuid,
  total_cents integer,
  platform_fee_cents integer,
  platform_fee_bps integer,
  currency text,
  discount_cents integer,
  promo_code text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result record;
  v_checkout_store_id uuid;
begin
  select checkout.store_id into v_checkout_store_id
  from public.storefront_checkout_sessions checkout
  where checkout.id = p_checkout_session_id
    and checkout.store_slug = p_store_slug
    and checkout.status = 'pending'
    and checkout.items = p_items
    and checkout.digital_manifest_id is not distinct from p_digital_manifest_id
  for update;

  if not found then
    raise exception 'Checkout session is unavailable';
  end if;

  select * into v_result
  from public.stub_checkout_create_paid_order(
    p_store_slug,
    p_customer_email,
    p_customer_user_id,
    p_items,
    p_stub_payment_ref,
    p_discount_cents,
    p_promo_code
  );

  if p_digital_manifest_id is not null then
    perform public.lock_digital_checkout_manifest(
      p_digital_manifest_id,
      v_result.order_id
    );
  else
    update public.storefront_checkout_sessions
    set order_id = v_result.order_id
    where id = p_checkout_session_id
      and store_id = v_checkout_store_id;
  end if;

  update public.storefront_checkout_sessions
  set status = 'completed',
      order_id = v_result.order_id,
      stripe_payment_intent_id = p_stub_payment_ref,
      error_message = null
  where id = p_checkout_session_id
    and store_id = v_checkout_store_id;

  return query select
    v_result.order_id,
    v_result.total_cents,
    v_result.platform_fee_cents,
    v_result.platform_fee_bps,
    v_result.currency,
    v_result.discount_cents,
    v_result.promo_code;
end;
$$;

revoke all on function public.enforce_storefront_checkout_manifest_binding()
from public, anon, authenticated;
revoke all on function public.enforce_digital_manifest_snapshot_identity()
from public, anon, authenticated;
revoke all on function public.digital_purchase_manifest_snapshot(uuid)
from public, anon, authenticated;
revoke all on function public.create_or_reuse_digital_checkout_manifest(
  uuid, uuid, jsonb, text, timestamptz, text
)
from public, anon, authenticated;
revoke all on function public.lock_digital_checkout_manifest(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.stub_checkout_create_paid_order_with_manifest(
  text, text, uuid, jsonb, text, integer, text, uuid, uuid
)
from public, anon, authenticated;

grant execute on function public.digital_purchase_manifest_snapshot(uuid)
to service_role;
grant execute on function public.create_or_reuse_digital_checkout_manifest(
  uuid, uuid, jsonb, text, timestamptz, text
)
to service_role;
grant execute on function public.lock_digital_checkout_manifest(uuid, uuid)
to service_role;
grant execute on function public.stub_checkout_create_paid_order_with_manifest(
  text, text, uuid, jsonb, text, integer, text, uuid, uuid
)
to service_role;
