-- Make checkout type/composition snapshots agree with authoritative catalog
-- identity, and expose one transactionally safe repair boundary for customer
-- carts hydrated from persisted data.

create or replace function public.enforce_digital_checkout_policy_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_policy public.digital_checkout_policy_versions%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_snapshot_product_type text;
  v_catalog_product_type text;
  v_has_digital boolean := false;
  v_has_physical boolean := false;
  v_authoritative_composition text;
begin
  if new.items is null
     or jsonb_typeof(new.items) <> 'array'
     or jsonb_array_length(new.items) = 0
  then
    raise exception 'Checkout item snapshot is invalid';
  end if;

  for v_item in select * from jsonb_array_elements(new.items)
  loop
    v_product_id := nullif(v_item ->> 'productId', '')::uuid;
    v_variant_id := nullif(v_item ->> 'variantId', '')::uuid;
    v_snapshot_product_type := nullif(v_item ->> 'productType', '');

    if v_product_id is null or v_variant_id is null then
      raise exception 'Checkout item identity is invalid';
    end if;

    select product.product_type into v_catalog_product_type
    from public.products product
    join public.product_variants variant
      on variant.id = v_variant_id
     and variant.product_id = product.id
     and variant.store_id = product.store_id
    where product.id = v_product_id
      and product.store_id = new.store_id;

    if not found then
      raise exception 'Checkout item does not belong to the selected store and product';
    end if;

    -- Application versions that predate digital products write checkout items
    -- without a productType key. Those writers can only sell physical catalog
    -- items, so the missing key is tolerated for physical products only;
    -- digital items always require an explicit, matching snapshot.
    if v_snapshot_product_type is null then
      if v_catalog_product_type = 'digital' then
        raise exception 'Checkout product type snapshot does not match the catalog';
      end if;
    elsif v_snapshot_product_type is distinct from v_catalog_product_type then
      raise exception 'Checkout product type snapshot does not match the catalog';
    end if;

    if v_catalog_product_type = 'digital' then
      v_has_digital := true;
    else
      v_has_physical := true;
    end if;
  end loop;

  v_authoritative_composition := case
    when v_has_digital and v_has_physical then 'mixed'
    when v_has_digital then 'digital_only'
    else 'physical_only'
  end;

  if new.checkout_composition is null then
    -- Digital checkouts always require an explicit composition snapshot.
    -- Physical-only writes from application versions that predate the
    -- snapshot derive the authoritative value instead of failing, so a
    -- deploy-window version skew (or an application rollback) cannot break
    -- live checkouts. Clearing an existing snapshot is still rejected, and
    -- untouched legacy rows keep their null snapshot.
    if v_has_digital then
      raise exception 'Checkout composition snapshot is required';
    end if;
    if tg_op = 'INSERT' then
      new.checkout_composition := v_authoritative_composition;
    elsif old.checkout_composition is not null then
      raise exception 'Checkout composition snapshot is required';
    elsif new.items is distinct from old.items then
      new.checkout_composition := v_authoritative_composition;
    end if;
  elsif new.checkout_composition is distinct from v_authoritative_composition then
    raise exception 'Checkout composition snapshot does not match the catalog';
  end if;

  if not v_has_digital then
    return new;
  end if;

  select * into v_policy
  from public.digital_checkout_policy_versions policy
  where policy.singleton = true;
  if not found then
    raise exception 'Digital checkout policy is not configured';
  end if;

  if new.digital_consent_version is distinct from v_policy.consent_version
     or new.digital_license_version is distinct from v_policy.license_version
     or new.digital_consent_accepted_at is null
     or new.digital_consent_accepted_at > statement_timestamp() + interval '5 minutes'
  then
    raise exception 'Digital checkout consent and license snapshot is invalid';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_digital_checkout_policy_snapshot()
from public, anon, authenticated, service_role;

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
    raise exception 'Active customer cart not found';
  end if;

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
        when product.product_type = 'digital' then 1
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
    group by product.id, variant.id, product.product_type, variant.price_cents
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
          item.quantity is distinct from case when product.product_type = 'digital' then 1 else item.quantity end
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

revoke all on function public.repair_authenticated_customer_cart(uuid)
from public, anon, service_role;
grant execute on function public.repair_authenticated_customer_cart(uuid)
to authenticated;
