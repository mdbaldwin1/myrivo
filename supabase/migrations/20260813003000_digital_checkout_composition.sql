-- Persist checkout composition as part of the immutable purchase attempt and
-- keep digital lines out of the physical inventory/fulfillment lifecycle.

alter table public.storefront_checkout_sessions
  add column if not exists checkout_composition text;

alter table public.storefront_checkout_sessions
  add constraint storefront_checkout_sessions_composition_check
    check (
      checkout_composition is null
      or checkout_composition in ('digital_only', 'physical_only', 'mixed')
    );

alter table public.orders
  drop constraint if exists orders_fulfillment_method_check;
alter table public.orders
  add constraint orders_fulfillment_method_check
    check (fulfillment_method in ('pickup', 'shipping', 'digital_delivery'));

alter table public.storefront_checkout_sessions
  drop constraint if exists storefront_checkout_sessions_fulfillment_method_check;
alter table public.storefront_checkout_sessions
  add constraint storefront_checkout_sessions_fulfillment_method_check
    check (fulfillment_method in ('pickup', 'shipping', 'digital_delivery'));

create or replace function public.enforce_storefront_checkout_composition_snapshot()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.checkout_attempt_key is not null
     and (
       new.items is distinct from old.items
       or new.checkout_composition is distinct from old.checkout_composition
     )
  then
    raise exception 'Checkout item composition snapshot is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_storefront_checkout_composition_snapshot
on public.storefront_checkout_sessions;
create trigger enforce_storefront_checkout_composition_snapshot
before update of items, checkout_composition
on public.storefront_checkout_sessions
for each row execute function public.enforce_storefront_checkout_composition_snapshot();

create or replace function public.create_or_reuse_storefront_checkout_attempt(
  p_store_id uuid,
  p_checkout_attempt_key text,
  p_request_fingerprint_sha256 text,
  p_checkout jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_input public.storefront_checkout_sessions%rowtype;
  v_checkout public.storefront_checkout_sessions%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_snapshot_product_type text;
  v_catalog_product_type text;
  v_requested_composition text;
  v_derived_composition text;
  v_has_digital boolean := false;
  v_has_physical boolean := false;
  v_inserted boolean := false;
begin
  if p_store_id is null
     or p_checkout_attempt_key is null
     or char_length(p_checkout_attempt_key) not between 16 and 128
     or p_checkout_attempt_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]+$'
  then
    raise exception 'Checkout attempt key is invalid';
  end if;
  if p_request_fingerprint_sha256 is null
     or p_request_fingerprint_sha256 !~ '^[a-f0-9]{64}$'
  then
    raise exception 'Checkout request fingerprint is invalid';
  end if;

  -- A retry is resolved from the stored snapshot before consulting mutable
  -- catalog state. This is the database-level equivalent of the route's
  -- early checkout-attempt recovery path.
  select * into v_checkout
  from public.storefront_checkout_sessions checkout
  where checkout.store_id = p_store_id
    and checkout.checkout_attempt_key = p_checkout_attempt_key
  for update;
  if found then
    if v_checkout.checkout_request_fingerprint_sha256 is distinct from p_request_fingerprint_sha256 then
      raise exception 'Checkout attempt key was already used for different purchase details';
    end if;
    return to_jsonb(v_checkout) || jsonb_build_object('created', false);
  end if;

  if p_checkout is null or jsonb_typeof(p_checkout) <> 'object' then
    raise exception 'Checkout snapshot is invalid';
  end if;

  v_input := jsonb_populate_record(null::public.storefront_checkout_sessions, p_checkout);
  v_requested_composition := v_input.checkout_composition;
  if coalesce(char_length(trim(v_input.store_slug)), 0) = 0
     or coalesce(char_length(trim(v_input.customer_email)), 0) = 0
     or v_input.items is null
     or jsonb_typeof(v_input.items) <> 'array'
     or jsonb_array_length(v_input.items) = 0
     or v_input.status is distinct from 'pending'
     or v_input.checkout_mode is null
     or v_input.checkout_mode not in ('stripe', 'stub')
     or v_input.tax_collection_mode_snapshot is null
     or v_input.tax_collection_mode_snapshot not in ('unconfigured', 'stripe_tax', 'seller_attested_no_tax')
     or v_input.applied_promotions_json is null
     or jsonb_typeof(v_input.applied_promotions_json) <> 'array'
     or (
       v_input.checkout_mode = 'stripe'
       and coalesce(char_length(trim(v_input.stripe_account_id_snapshot)), 0) = 0
     )
  then
    raise exception 'Checkout snapshot is invalid';
  end if;

  for v_item in select * from jsonb_array_elements(v_input.items)
  loop
    v_product_id := nullif(v_item ->> 'productId', '')::uuid;
    v_variant_id := nullif(v_item ->> 'variantId', '')::uuid;
    v_quantity := nullif(v_item ->> 'quantity', '')::integer;
    v_snapshot_product_type := nullif(v_item ->> 'productType', '');

    if v_product_id is null or v_variant_id is null
       or v_quantity is null or v_quantity <= 0
       or v_snapshot_product_type not in ('physical', 'digital')
    then
      raise exception 'Checkout item snapshot is invalid';
    end if;

    select product.product_type into v_catalog_product_type
    from public.products product
    join public.product_variants variant
      on variant.id = v_variant_id
     and variant.product_id = product.id
     and variant.store_id = product.store_id
    where product.id = v_product_id
      and product.store_id = p_store_id;

    if not found or v_catalog_product_type is distinct from v_snapshot_product_type then
      raise exception 'Checkout product type snapshot is invalid';
    end if;

    if v_snapshot_product_type = 'digital' then
      if v_quantity <> 1 then
        raise exception 'Digital checkout quantity must be one';
      end if;
      v_has_digital := true;
    else
      v_has_physical := true;
    end if;
  end loop;

  v_derived_composition := case
    when v_has_digital and v_has_physical then 'mixed'
    when v_has_digital then 'digital_only'
    else 'physical_only'
  end;
  if v_requested_composition is not null
     and v_requested_composition is distinct from v_derived_composition
  then
    raise exception 'Checkout composition does not match item snapshots';
  end if;
  v_input.checkout_composition := v_derived_composition;

  if v_derived_composition = 'digital_only' then
    if v_requested_composition is not null
       and (
         v_input.fulfillment_method is distinct from 'digital_delivery'
         or v_input.customer_phone is not null
         or coalesce(v_input.shipping_fee_cents, 0) <> 0
         or v_input.pickup_location_id is not null
         or v_input.pickup_location_snapshot_json is not null
         or v_input.pickup_window_start_at is not null
         or v_input.pickup_window_end_at is not null
         or v_input.pickup_timezone is not null
       )
    then
      raise exception 'Digital-only fulfillment snapshot is invalid';
    end if;

    -- Normalize older callers that predate the explicit composition field.
    v_input.customer_phone := null;
    v_input.fulfillment_method := 'digital_delivery';
    v_input.fulfillment_label := 'Digital delivery';
    v_input.shipping_fee_cents := 0;
    v_input.pickup_location_id := null;
    v_input.pickup_location_snapshot_json := null;
    v_input.pickup_window_start_at := null;
    v_input.pickup_window_end_at := null;
    v_input.pickup_timezone := null;
  elsif v_input.fulfillment_method not in ('pickup', 'shipping')
        or coalesce(char_length(trim(v_input.customer_phone)), 0) = 0
  then
    raise exception 'Physical fulfillment snapshot is invalid';
  end if;

  insert into public.storefront_checkout_sessions(
    store_id, store_slug, customer_email, customer_first_name,
    customer_last_name, customer_phone, customer_note,
    fulfillment_method, fulfillment_label, shipping_fee_cents,
    pickup_location_id, pickup_location_snapshot_json,
    pickup_window_start_at, pickup_window_end_at, pickup_timezone,
    promo_code, promo_codes_json, applied_promotions_json,
    analytics_session_key, analytics_session_id, source_cart_id,
    fee_plan_key, fee_bps, fee_fixed_cents, item_total_cents,
    platform_fee_cents, attribution_json, items, checkout_composition,
    digital_consent_version, digital_consent_accepted_at,
    digital_license_version, checkout_mode, stripe_account_id_snapshot,
    tax_collection_mode_snapshot, status, checkout_attempt_key,
    checkout_request_fingerprint_sha256
  ) values (
    p_store_id, v_input.store_slug, lower(trim(v_input.customer_email)),
    v_input.customer_first_name, v_input.customer_last_name,
    v_input.customer_phone, v_input.customer_note,
    v_input.fulfillment_method, v_input.fulfillment_label,
    coalesce(v_input.shipping_fee_cents, 0), v_input.pickup_location_id,
    v_input.pickup_location_snapshot_json, v_input.pickup_window_start_at,
    v_input.pickup_window_end_at, v_input.pickup_timezone,
    v_input.promo_code, coalesce(v_input.promo_codes_json, '[]'::jsonb),
    coalesce(v_input.applied_promotions_json, '[]'::jsonb),
    v_input.analytics_session_key, v_input.analytics_session_id,
    v_input.source_cart_id, v_input.fee_plan_key, v_input.fee_bps,
    v_input.fee_fixed_cents, v_input.item_total_cents,
    v_input.platform_fee_cents, coalesce(v_input.attribution_json, '{}'::jsonb),
    v_input.items, v_input.checkout_composition,
    v_input.digital_consent_version, v_input.digital_consent_accepted_at,
    v_input.digital_license_version, v_input.checkout_mode,
    v_input.stripe_account_id_snapshot, v_input.tax_collection_mode_snapshot,
    'pending', p_checkout_attempt_key, p_request_fingerprint_sha256
  )
  on conflict (store_id, checkout_attempt_key) do nothing
  returning * into v_checkout;

  if found then
    v_inserted := true;
  else
    select * into v_checkout
    from public.storefront_checkout_sessions checkout
    where checkout.store_id = p_store_id
      and checkout.checkout_attempt_key = p_checkout_attempt_key
    for update;
    if not found then
      raise exception 'Checkout attempt could not be resolved';
    end if;
  end if;

  if v_checkout.checkout_request_fingerprint_sha256 is distinct from p_request_fingerprint_sha256 then
    raise exception 'Checkout attempt key was already used for different purchase details';
  end if;

  return to_jsonb(v_checkout) || jsonb_build_object('created', v_inserted);
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
  v_checkout public.storefront_checkout_sessions%rowtype;
  v_order public.orders%rowtype;
  v_item jsonb;
  v_variant public.product_variants%rowtype;
  v_product public.products%rowtype;
  v_product_id uuid;
  v_variant_id uuid;
  v_promotion_id uuid;
  v_quantity integer;
  v_unit_price_cents integer;
  v_product_type text;
  v_has_digital boolean := false;
  v_has_physical boolean := false;
  v_derived_composition text;
  v_subtotal_cents integer := 0;
  v_item_total_cents integer;
  v_shipping_fee_cents integer;
  v_total_cents integer;
  v_discount_cents integer;
  v_payment_ref text;
  v_customer_user_id uuid;
begin
  select * into v_checkout
  from public.storefront_checkout_sessions checkout
  where checkout.id = p_checkout_session_id
    and checkout.store_slug = p_store_slug
  for update;

  if not found then
    raise exception 'Checkout session is unavailable';
  end if;

  v_payment_ref := coalesce(
    nullif(trim(p_stub_payment_ref), ''),
    v_checkout.stripe_payment_intent_id,
    'stub_pi_' || replace(v_checkout.id::text, '-', '')
  );

  if v_checkout.status = 'completed' then
    if v_checkout.order_id is null
       or v_checkout.stripe_payment_intent_id is distinct from v_payment_ref
    then
      raise exception 'Completed checkout identity does not match';
    end if;

    return query
    select placed_order.id, placed_order.total_cents,
           coalesce(fees.platform_fee_cents, v_checkout.platform_fee_cents, 0),
           coalesce(fees.fee_bps, v_checkout.fee_bps, 0),
           placed_order.currency, placed_order.discount_cents,
           placed_order.promo_code
    from public.orders placed_order
    left join public.order_fee_breakdowns fees on fees.order_id = placed_order.id
    where placed_order.id = v_checkout.order_id
      and placed_order.store_id = v_checkout.store_id
      and placed_order.stripe_payment_intent_id = v_payment_ref;

    if not found then
      raise exception 'Completed checkout order is unavailable';
    end if;
    return;
  end if;

  if v_checkout.status <> 'pending'
     or v_checkout.items is null
     or jsonb_typeof(v_checkout.items) <> 'array'
     or jsonb_array_length(v_checkout.items) = 0
     or v_checkout.digital_manifest_id is distinct from p_digital_manifest_id
  then
    raise exception 'Checkout session is unavailable';
  end if;

  for v_item in select * from jsonb_array_elements(v_checkout.items)
  loop
    v_product_id := nullif(v_item ->> 'productId', '')::uuid;
    v_variant_id := nullif(v_item ->> 'variantId', '')::uuid;
    v_quantity := nullif(v_item ->> 'quantity', '')::integer;
    v_unit_price_cents := nullif(v_item ->> 'unitPriceCents', '')::integer;
    v_product_type := nullif(v_item ->> 'productType', '');

    if v_product_id is null or v_variant_id is null
       or v_quantity is null or v_quantity <= 0
       or v_unit_price_cents is null or v_unit_price_cents < 0
    then
      raise exception 'Checkout item snapshot is invalid';
    end if;

    select variant.* into v_variant
    from public.product_variants variant
    where variant.id = v_variant_id
      and variant.product_id = v_product_id
      and variant.store_id = v_checkout.store_id
    for update;
    if not found then
      raise exception 'Checkout inventory identity is unavailable';
    end if;

    if v_product_type is null then
      select product.product_type into v_product_type
      from public.products product
      where product.id = v_product_id
        and product.store_id = v_checkout.store_id;
    end if;
    if v_product_type not in ('physical', 'digital') then
      raise exception 'Checkout product type snapshot is invalid';
    end if;

    if v_product_type = 'digital' then
      if v_quantity <> 1 then
        raise exception 'Digital checkout quantity must be one';
      end if;
      v_has_digital := true;
    else
      v_has_physical := true;
      if not v_variant.is_made_to_order and v_variant.inventory_qty < v_quantity then
        raise exception 'Insufficient inventory for checkout snapshot';
      end if;
    end if;

    v_subtotal_cents := v_subtotal_cents + (v_unit_price_cents * v_quantity);
  end loop;

  v_derived_composition := case
    when v_has_digital and v_has_physical then 'mixed'
    when v_has_digital then 'digital_only'
    else 'physical_only'
  end;
  if v_checkout.checkout_composition is not null
     and v_checkout.checkout_composition is distinct from v_derived_composition
  then
    raise exception 'Checkout composition snapshot is invalid';
  end if;

  v_item_total_cents := greatest(
    0,
    coalesce(v_checkout.item_total_cents, v_subtotal_cents - greatest(coalesce(p_discount_cents, 0), 0))
  );
  v_discount_cents := greatest(0, v_subtotal_cents - v_item_total_cents);
  v_shipping_fee_cents := case
    when v_derived_composition = 'digital_only' then 0
    else greatest(coalesce(v_checkout.shipping_fee_cents, 0), 0)
  end;
  v_total_cents := v_item_total_cents + v_shipping_fee_cents;

  insert into public.orders(
    store_id, customer_email, customer_first_name, customer_last_name,
    customer_phone, customer_note, currency, subtotal_cents, discount_cents,
    shipping_fee_cents, total_cents, status, stripe_payment_intent_id,
    promo_code, fulfillment_method, fulfillment_label, pickup_location_id,
    pickup_location_snapshot_json, pickup_window_start_at,
    pickup_window_end_at, pickup_timezone, analytics_session_id,
    analytics_session_key, source_cart_id, storefront_checkout_session_id,
    digital_consent_version, digital_consent_accepted_at,
    digital_license_version
  ) values (
    v_checkout.store_id, v_checkout.customer_email,
    v_checkout.customer_first_name, v_checkout.customer_last_name,
    case when v_derived_composition = 'digital_only' then null else v_checkout.customer_phone end,
    v_checkout.customer_note, 'usd', v_subtotal_cents, v_discount_cents,
    v_shipping_fee_cents, v_total_cents, 'paid', v_payment_ref,
    v_checkout.promo_code,
    case when v_derived_composition = 'digital_only' then 'digital_delivery' else v_checkout.fulfillment_method end,
    case when v_derived_composition = 'digital_only' then 'Digital delivery' else v_checkout.fulfillment_label end,
    case when v_derived_composition = 'digital_only' then null else v_checkout.pickup_location_id end,
    case when v_derived_composition = 'digital_only' then null else v_checkout.pickup_location_snapshot_json end,
    case when v_derived_composition = 'digital_only' then null else v_checkout.pickup_window_start_at end,
    case when v_derived_composition = 'digital_only' then null else v_checkout.pickup_window_end_at end,
    case when v_derived_composition = 'digital_only' then null else v_checkout.pickup_timezone end,
    v_checkout.analytics_session_id, v_checkout.analytics_session_key,
    v_checkout.source_cart_id, v_checkout.id, v_checkout.digital_consent_version,
    v_checkout.digital_consent_accepted_at, v_checkout.digital_license_version
  ) returning * into v_order;

  for v_item in select * from jsonb_array_elements(v_checkout.items)
  loop
    v_product_id := (v_item ->> 'productId')::uuid;
    v_variant_id := (v_item ->> 'variantId')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_price_cents := (v_item ->> 'unitPriceCents')::integer;
    v_product_type := nullif(v_item ->> 'productType', '');

    select product.* into v_product
    from public.products product
    where product.id = v_product_id
      and product.store_id = v_checkout.store_id
    for update;
    if not found then
      raise exception 'Checkout product identity is unavailable';
    end if;
    v_product_type := coalesce(v_product_type, v_product.product_type);

    insert into public.order_items(
      order_id, store_id, product_id, product_variant_id, quantity,
      unit_price_cents, variant_label, variant_snapshot, product_type
    ) values (
      v_order.id, v_checkout.store_id, v_product_id, v_variant_id, v_quantity,
      v_unit_price_cents, nullif(v_item ->> 'variantLabel', ''),
      jsonb_build_object(
        'variantTitle', nullif(v_item ->> 'variantLabel', ''),
        'productTitle', nullif(v_item ->> 'productTitle', ''),
        'checkoutSnapshot', true
      ),
      v_product_type
    );

    if v_product_type = 'physical' then
      update public.product_variants
      set inventory_qty = greatest(inventory_qty - v_quantity, 0)
      where id = v_variant_id;

      update public.products product
      set price_cents = coalesce(rollup.min_price_cents, product.price_cents),
          inventory_qty = coalesce(rollup.total_inventory_qty, product.inventory_qty),
          sku = coalesce(rollup.default_sku, product.sku)
      from (
        select min(variant.price_cents) filter (where variant.status = 'active') as min_price_cents,
               sum(variant.inventory_qty) filter (where variant.status = 'active') as total_inventory_qty,
               max(variant.sku) filter (where variant.is_default) as default_sku
        from public.product_variants variant
        where variant.product_id = v_product_id
      ) rollup
      where product.id = v_product_id;

      insert into public.inventory_movements(
        store_id, product_id, product_variant_id, order_id,
        delta_qty, reason, note
      ) values (
        v_checkout.store_id, v_product_id, v_variant_id, v_order.id,
        -v_quantity, 'sale', 'Checkout sale'
      );
    end if;
  end loop;

  if v_checkout.source_cart_id is not null then
    select cart.user_id into v_customer_user_id
    from public.customer_carts cart
    where cart.id = v_checkout.source_cart_id
      and cart.store_id = v_checkout.store_id;
  end if;

  for v_item in select * from jsonb_array_elements(v_checkout.applied_promotions_json)
  loop
    v_promotion_id := nullif(v_item ->> 'promotionId', '')::uuid;
    if v_promotion_id is null or not exists (
      select 1 from public.promotions promotion
      where promotion.id = v_promotion_id
        and promotion.store_id = v_checkout.store_id
    ) then
      raise exception 'Checkout promotion snapshot is unavailable';
    end if;

    insert into public.promotion_redemptions(
      store_id, promotion_id, order_id, customer_user_id,
      customer_email_normalized
    ) values (
      v_checkout.store_id, v_promotion_id, v_order.id, v_customer_user_id,
      lower(trim(v_checkout.customer_email))
    ) on conflict (order_id, promotion_id) do nothing;

    update public.promotions promotion
    set times_redeemed = (
      select count(*) from public.promotion_redemptions redemption
      where redemption.promotion_id = promotion.id
    )
    where promotion.id = v_promotion_id;
  end loop;

  insert into public.order_fee_breakdowns(
    order_id, store_id, plan_key, fee_bps, fee_fixed_cents,
    subtotal_cents, platform_fee_cents, net_payout_cents
  ) values (
    v_order.id, v_checkout.store_id, v_checkout.fee_plan_key,
    coalesce(v_checkout.fee_bps, 0), coalesce(v_checkout.fee_fixed_cents, 0),
    v_total_cents, coalesce(v_checkout.platform_fee_cents, 0),
    greatest(0, v_total_cents - coalesce(v_checkout.platform_fee_cents, 0))
  );

  if v_checkout.source_cart_id is not null then
    update public.customer_carts
    set status = 'ordered'
    where id = v_checkout.source_cart_id
      and store_id = v_checkout.store_id;
  end if;

  if v_checkout.digital_manifest_id is not null then
    perform public.lock_digital_checkout_manifest(v_checkout.digital_manifest_id, v_order.id);
  end if;

  update public.storefront_checkout_sessions
  set status = 'completed', order_id = v_order.id,
      stripe_payment_intent_id = v_payment_ref, error_message = null
  where id = v_checkout.id;

  return query select v_order.id, v_total_cents,
    coalesce(v_checkout.platform_fee_cents, 0),
    coalesce(v_checkout.fee_bps, 0), 'usd'::text,
    v_discount_cents, v_checkout.promo_code;
end;
$$;

revoke all on function public.enforce_storefront_checkout_composition_snapshot()
from public, anon, authenticated;
revoke all on function public.create_or_reuse_storefront_checkout_attempt(uuid, text, text, jsonb)
from public, anon, authenticated;
grant execute on function public.create_or_reuse_storefront_checkout_attempt(uuid, text, text, jsonb)
to service_role;
revoke all on function public.stub_checkout_create_paid_order_with_manifest(text, text, uuid, jsonb, text, integer, text, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.stub_checkout_create_paid_order_with_manifest(text, text, uuid, jsonb, text, integer, text, uuid, uuid)
to service_role;
