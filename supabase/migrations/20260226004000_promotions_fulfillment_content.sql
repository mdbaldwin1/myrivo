create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  min_subtotal_cents integer not null default 0 check (min_subtotal_cents >= 0),
  max_redemptions integer,
  times_redeemed integer not null default 0 check (times_redeemed >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, code)
);

create trigger promotions_set_updated_at
before update on public.promotions
for each row execute function public.set_updated_at();

alter table public.promotions enable row level security;

create policy promotions_owner_all on public.promotions
for all
using (
  exists (
    select 1 from public.stores s
    where s.id = promotions.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = promotions.store_id
      and s.owner_user_id = auth.uid()
  )
);

alter table public.orders
  add column if not exists discount_cents integer not null default 0 check (discount_cents >= 0),
  add column if not exists promo_code text,
  add column if not exists fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled', 'processing', 'fulfilled', 'shipped')),
  add column if not exists fulfilled_at timestamptz,
  add column if not exists shipped_at timestamptz;

create table if not exists public.store_content_blocks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  sort_order integer not null default 0,
  eyebrow text,
  title text not null,
  body text not null,
  cta_label text,
  cta_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_store_content_blocks_store_id on public.store_content_blocks(store_id);
create index if not exists idx_store_content_blocks_sort_order on public.store_content_blocks(store_id, sort_order);

create trigger store_content_blocks_set_updated_at
before update on public.store_content_blocks
for each row execute function public.set_updated_at();

alter table public.store_content_blocks enable row level security;

create policy content_blocks_owner_all on public.store_content_blocks
for all
using (
  exists (
    select 1 from public.stores s
    where s.id = store_content_blocks.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = store_content_blocks.store_id
      and s.owner_user_id = auth.uid()
  )
);

create policy content_blocks_public_read on public.store_content_blocks
for select
using (
  is_active = true
  and exists (
    select 1 from public.stores s
    where s.id = store_content_blocks.store_id
      and s.status = 'active'
  )
);

drop function if exists public.stub_checkout_create_paid_order(text, text, jsonb, text);

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
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_subtotal integer := 0;
  v_fee_bps integer := 200;
  v_fee_cents integer := 0;
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

  if v_discount > v_subtotal then
    v_discount := v_subtotal;
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

  if v_promo is not null then
    update public.promotions
    set times_redeemed = times_redeemed + 1
    where store_id = v_store.id
      and code = v_promo;
  end if;

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

revoke all on function public.stub_checkout_create_paid_order(text, text, jsonb, text, integer, text) from public;
grant execute on function public.stub_checkout_create_paid_order(text, text, jsonb, text, integer, text) to service_role;
