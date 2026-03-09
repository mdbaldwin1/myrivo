drop function if exists public.stub_checkout_create_paid_order(text, text, jsonb, text, integer, text);

create or replace function public.stub_checkout_create_paid_order(
  p_store_slug text,
  p_customer_email text,
  p_items jsonb,
  p_stub_payment_ref text default null,
  p_promo_code text default null
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
set search_path = public
as $$
declare
  v_store public.stores%rowtype;
  v_product public.products%rowtype;
  v_promotion public.promotions%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_subtotal integer := 0;
  v_fee_bps integer := 200;
  v_fee_cents integer := 0;
  v_total integer := 0;
  v_order_id uuid;
  v_discount integer := 0;
  v_promo text := nullif(upper(trim(p_promo_code)), '');
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

  select s.platform_fee_bps
    into v_fee_bps
  from public.subscriptions s
  where s.store_id = v_store.id
    and s.status = 'active'
  limit 1;

  if v_fee_bps is null then
    v_fee_bps := 200;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'productId')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_product_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'Each cart item requires productId and positive quantity';
    end if;

    select * into v_product
    from public.products p
    where p.id = v_product_id
      and p.store_id = v_store.id
      and p.status = 'active'
    for update;

    if not found then
      raise exception 'Product % is unavailable', v_product_id;
    end if;

    if v_product.inventory_qty < v_quantity then
      raise exception 'Insufficient inventory for % (available: %)', v_product.title, v_product.inventory_qty;
    end if;

    v_subtotal := v_subtotal + (v_product.price_cents * v_quantity);
  end loop;

  if v_promo is not null then
    select * into v_promotion
    from public.promotions promo
    where promo.store_id = v_store.id
      and promo.code = v_promo
      and promo.is_active = true
      and (promo.starts_at is null or promo.starts_at <= now())
      and (promo.ends_at is null or promo.ends_at >= now())
    for update;

    if not found then
      raise exception 'Promo code is invalid or inactive';
    end if;

    if v_subtotal < v_promotion.min_subtotal_cents then
      raise exception 'Promo requires minimum subtotal of % cents', v_promotion.min_subtotal_cents;
    end if;

    if v_promotion.max_redemptions is not null and v_promotion.times_redeemed >= v_promotion.max_redemptions then
      raise exception 'Promo code redemption limit reached';
    end if;

    if v_promotion.discount_type = 'fixed' then
      v_discount := least(v_subtotal, v_promotion.discount_value);
    else
      v_discount := round((v_subtotal * least(100, greatest(1, v_promotion.discount_value)))::numeric / 100);
    end if;

    update public.promotions
    set times_redeemed = times_redeemed + 1
    where id = v_promotion.id;
  end if;

  v_fee_cents := round(((v_subtotal - v_discount) * v_fee_bps)::numeric / 10000);
  v_total := v_subtotal - v_discount;

  insert into public.orders (
    store_id,
    customer_email,
    currency,
    subtotal_cents,
    total_cents,
    status,
    stripe_payment_intent_id,
    platform_fee_bps,
    platform_fee_cents,
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
    v_fee_bps,
    v_fee_cents,
    v_discount,
    v_promo
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'productId')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    select * into v_product
    from public.products p
    where p.id = v_product_id
      and p.store_id = v_store.id
    for update;

    insert into public.order_items (order_id, product_id, quantity, unit_price_cents)
    values (v_order_id, v_product.id, v_quantity, v_product.price_cents);

    update public.products
    set inventory_qty = inventory_qty - v_quantity
    where id = v_product.id;

    insert into public.inventory_movements (store_id, product_id, order_id, delta_qty, reason, note)
    values (v_store.id, v_product.id, v_order_id, -v_quantity, 'sale', 'Checkout sale');
  end loop;

  return query
  select v_order_id, v_total, v_fee_cents, v_fee_bps, 'usd'::text, v_discount, v_promo;
end;
$$;

revoke all on function public.stub_checkout_create_paid_order(text, text, jsonb, text, text) from public;
grant execute on function public.stub_checkout_create_paid_order(text, text, jsonb, text, text) to service_role;
