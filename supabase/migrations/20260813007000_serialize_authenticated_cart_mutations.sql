-- Serialize every authenticated cart mutation by locking the parent cart before
-- reading or changing child rows. Direct child writes are revoked so application
-- callers cannot bypass this transaction protocol.

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

create or replace function public.clear_authenticated_customer_cart(
  p_cart_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform 1
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

  update public.customer_carts cart
  set status = 'abandoned',
      metadata_json = '{}'::jsonb
  where cart.id = p_cart_id;

  return true;
end;
$$;

revoke insert, update, delete on table public.customer_cart_items
from anon, authenticated, service_role;

revoke all on function public.repair_authenticated_customer_cart(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.replace_authenticated_customer_cart_items(uuid, jsonb)
from public, anon, authenticated, service_role;
revoke all on function public.clear_authenticated_customer_cart(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.repair_authenticated_customer_cart(uuid)
to authenticated;
grant execute on function public.replace_authenticated_customer_cart_items(uuid, jsonb)
to authenticated;
grant execute on function public.clear_authenticated_customer_cart(uuid)
to authenticated;
