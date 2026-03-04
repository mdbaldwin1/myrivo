-- Variant-level made-to-order support.
-- Allows checkout on variants with zero inventory when explicitly enabled.

alter table public.product_variants
  add column if not exists is_made_to_order boolean not null default false;

drop function if exists public.stub_checkout_create_paid_order(text, text, jsonb, text, integer, text);

create or replace function public.stub_checkout_create_paid_order(
  p_store_slug text,
  p_customer_email text,
  p_items jsonb,
  p_stub_payment_ref text default null,
  p_discount_cents integer default 0,
  p_promo_code text default null
)
returns table (
  order_id uuid,
  total_cents integer,
  currency text,
  discount_cents integer,
  promo_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores%rowtype;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_subtotal integer := 0;
  v_total integer := 0;
  v_order_id uuid;
  v_discount integer := greatest(coalesce(p_discount_cents, 0), 0);
  v_promo text := nullif(trim(p_promo_code), '');
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Checkout requires at least one item';
  end if;

  select * into v_store
  from public.stores
  where slug = p_store_slug
    and status = 'active'
  limit 1;

  if not found then
    raise exception 'Store not found or inactive';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item ->> 'productId', '')::uuid;
    v_variant_id := nullif(v_item ->> 'variantId', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Each cart item requires positive quantity';
    end if;

    if v_variant_id is not null then
      select pv.* into v_variant
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      where pv.id = v_variant_id
        and pv.store_id = v_store.id
        and pv.status = 'active'
        and p.status = 'active'
      for update;

      if not found then
        raise exception 'Variant % is unavailable', v_variant_id;
      end if;

      v_product_id := v_variant.product_id;
    elsif v_product_id is not null then
      select pv.* into v_variant
      from public.product_variants pv
      where pv.product_id = v_product_id
        and pv.store_id = v_store.id
        and pv.status = 'active'
      order by pv.is_default desc, pv.sort_order asc, pv.created_at asc
      limit 1
      for update;

      if not found then
        raise exception 'Product % is unavailable', v_product_id;
      end if;
    else
      raise exception 'Each cart item requires productId or variantId';
    end if;

    if not v_variant.is_made_to_order and v_variant.inventory_qty < v_quantity then
      raise exception 'Insufficient inventory for % (available: %)', coalesce(v_variant.title, 'selected variant'), v_variant.inventory_qty;
    end if;

    v_subtotal := v_subtotal + (v_variant.price_cents * v_quantity);
  end loop;

  if v_discount > v_subtotal then
    v_discount := v_subtotal;
  end if;

  v_total := v_subtotal - v_discount;

  insert into public.orders (
    store_id,
    customer_email,
    currency,
    subtotal_cents,
    total_cents,
    status,
    stripe_payment_intent_id,
    discount_cents,
    promo_code
  ) values (
    v_store.id,
    p_customer_email,
    'usd',
    v_subtotal,
    v_total,
    'paid',
    coalesce(p_stub_payment_ref, 'stub_pi_' || replace(gen_random_uuid()::text, '-', '')),
    v_discount,
    v_promo
  )
  returning id into v_order_id;

  if v_promo is not null then
    update public.promotions
    set times_redeemed = times_redeemed + 1
    where store_id = v_store.id
      and code = v_promo;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item ->> 'productId', '')::uuid;
    v_variant_id := nullif(v_item ->> 'variantId', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_variant_id is not null then
      select pv.* into v_variant
      from public.product_variants pv
      where pv.id = v_variant_id
        and pv.store_id = v_store.id
      for update;

      if not found then
        raise exception 'Variant % is unavailable', v_variant_id;
      end if;

      v_product_id := v_variant.product_id;
    else
      select pv.* into v_variant
      from public.product_variants pv
      where pv.product_id = v_product_id
        and pv.store_id = v_store.id
      order by pv.is_default desc, pv.sort_order asc, pv.created_at asc
      limit 1
      for update;

      if not found then
        raise exception 'Product % is unavailable', v_product_id;
      end if;
    end if;

    select * into v_product
    from public.products p
    where p.id = v_variant.product_id
      and p.store_id = v_store.id
    for update;

    insert into public.order_items (order_id, product_id, product_variant_id, quantity, unit_price_cents, variant_label, variant_snapshot)
    values (
      v_order_id,
      v_product.id,
      v_variant.id,
      v_quantity,
      v_variant.price_cents,
      coalesce(v_variant.title, nullif(v_item ->> 'variantLabel', '')),
      jsonb_build_object(
        'variantTitle', v_variant.title,
        'optionValues', coalesce(v_variant.option_values, '{}'::jsonb)
      )
    );

    update public.product_variants
    set inventory_qty = greatest(inventory_qty - v_quantity, 0)
    where id = v_variant.id;

    update public.products p
    set
      price_cents = coalesce(rollup.min_price_cents, p.price_cents),
      inventory_qty = coalesce(rollup.total_inventory_qty, p.inventory_qty),
      sku = coalesce(rollup.default_sku, p.sku)
    from (
      select
        min(pv.price_cents) filter (where pv.status = 'active') as min_price_cents,
        sum(pv.inventory_qty) filter (where pv.status = 'active') as total_inventory_qty,
        max(pv.sku) filter (where pv.is_default) as default_sku
      from public.product_variants pv
      where pv.product_id = v_product.id
    ) as rollup
    where p.id = v_product.id;

    insert into public.inventory_movements (store_id, product_id, product_variant_id, order_id, delta_qty, reason, note)
    values (v_store.id, v_product.id, v_variant.id, v_order_id, -v_quantity, 'sale', 'Checkout sale');
  end loop;

  return query
  select v_order_id, v_total, 'usd'::text, v_discount, v_promo;
end;
$$;

revoke all on function public.stub_checkout_create_paid_order(text, text, jsonb, text, integer, text) from public;
grant execute on function public.stub_checkout_create_paid_order(text, text, jsonb, text, integer, text) to service_role;
