create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  delta_qty integer not null check (delta_qty <> 0),
  reason text not null check (reason in ('sale', 'restock', 'adjustment')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_movements_store_id on public.inventory_movements(store_id);
create index if not exists idx_inventory_movements_product_id on public.inventory_movements(product_id);
create index if not exists idx_inventory_movements_order_id on public.inventory_movements(order_id);

alter table public.inventory_movements enable row level security;

create policy inventory_movements_owner_all on public.inventory_movements
for all
using (
  exists (
    select 1 from public.stores s
    where s.id = inventory_movements.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = inventory_movements.store_id
      and s.owner_user_id = auth.uid()
  )
);

create or replace function public.stub_checkout_create_paid_order(
  p_store_slug text,
  p_customer_email text,
  p_items jsonb,
  p_stub_payment_ref text default null
)
returns table (
  order_id uuid,
  total_cents integer,
  platform_fee_cents integer,
  platform_fee_bps integer,
  currency text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_subtotal integer := 0;
  v_fee_bps integer := 200;
  v_fee_cents integer := 0;
  v_total integer := 0;
  v_order_id uuid;
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

  v_fee_cents := round((v_subtotal * v_fee_bps)::numeric / 10000);
  v_total := v_subtotal;

  insert into public.orders (
    store_id,
    customer_email,
    currency,
    subtotal_cents,
    total_cents,
    status,
    stripe_payment_intent_id,
    platform_fee_bps,
    platform_fee_cents
  ) values (
    v_store.id,
    p_customer_email,
    'usd',
    v_subtotal,
    v_total,
    'paid',
    coalesce(p_stub_payment_ref, 'stub_pi_' || replace(gen_random_uuid()::text, '-', '')),
    v_fee_bps,
    v_fee_cents
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
  select v_order_id, v_total, v_fee_cents, v_fee_bps, 'usd'::text;
end;
$$;

revoke all on function public.stub_checkout_create_paid_order(text, text, jsonb, text) from public;
grant execute on function public.stub_checkout_create_paid_order(text, text, jsonb, text) to service_role;
