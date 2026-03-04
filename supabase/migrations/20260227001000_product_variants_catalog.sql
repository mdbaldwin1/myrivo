create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  title text,
  sku text,
  option_values jsonb not null default '{}'::jsonb,
  price_cents integer not null check (price_cents >= 0),
  inventory_qty integer not null default 0 check (inventory_qty >= 0),
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_variants_product_id on public.product_variants(product_id);
create index if not exists idx_product_variants_store_id on public.product_variants(store_id);
create index if not exists idx_product_variants_status on public.product_variants(status);
create unique index if not exists idx_product_variants_default_per_product
  on public.product_variants(product_id)
  where is_default;

create trigger product_variants_set_updated_at
before update on public.product_variants
for each row execute function public.set_updated_at();

alter table public.product_variants enable row level security;

create policy product_variants_owner_all on public.product_variants
for all
using (
  exists (
    select 1 from public.stores s
    where s.id = product_variants.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = product_variants.store_id
      and s.owner_user_id = auth.uid()
  )
);

create policy product_variants_public_read on public.product_variants
for select
using (
  status = 'active'
  and exists (
    select 1
    from public.products p
    join public.stores s on s.id = p.store_id
    where p.id = product_variants.product_id
      and p.status = 'active'
      and s.status = 'active'
  )
);

alter table public.order_items
  add column if not exists product_variant_id uuid references public.product_variants(id) on delete set null,
  add column if not exists variant_label text,
  add column if not exists variant_snapshot jsonb not null default '{}'::jsonb;

create index if not exists idx_order_items_product_variant_id on public.order_items(product_variant_id);

alter table public.inventory_movements
  add column if not exists product_variant_id uuid references public.product_variants(id) on delete set null;

create index if not exists idx_inventory_movements_product_variant_id on public.inventory_movements(product_variant_id);

insert into public.product_variants (
  store_id,
  product_id,
  title,
  sku,
  option_values,
  price_cents,
  inventory_qty,
  is_default,
  status,
  sort_order
)
select
  p.store_id,
  p.id,
  null,
  p.sku,
  '{}'::jsonb,
  p.price_cents,
  p.inventory_qty,
  true,
  case when p.status = 'archived' then 'archived' else 'active' end,
  0
from public.products p
where not exists (
  select 1 from public.product_variants pv where pv.product_id = p.id
);

update public.products p
set
  price_cents = coalesce(rollup.min_price_cents, p.price_cents),
  inventory_qty = coalesce(rollup.total_inventory_qty, p.inventory_qty),
  sku = coalesce(rollup.default_sku, p.sku)
from (
  select
    pv.product_id,
    min(pv.price_cents) filter (where pv.status = 'active') as min_price_cents,
    sum(pv.inventory_qty) filter (where pv.status = 'active') as total_inventory_qty,
    max(pv.sku) filter (where pv.is_default) as default_sku
  from public.product_variants pv
  group by pv.product_id
) as rollup
where p.id = rollup.product_id;

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
  v_variant public.product_variants%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_subtotal integer := 0;
  v_fee_bps integer := 0;
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

    if v_variant.inventory_qty < v_quantity then
      raise exception 'Insufficient inventory for % (available: %)', coalesce(v_variant.title, 'selected variant'), v_variant.inventory_qty;
    end if;

    v_subtotal := v_subtotal + (v_variant.price_cents * v_quantity);
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
    set inventory_qty = inventory_qty - v_quantity
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
  select v_order_id, v_total, v_fee_cents, v_fee_bps, 'usd'::text, v_discount, v_promo;
end;
$$;

revoke all on function public.stub_checkout_create_paid_order(text, text, jsonb, text, integer, text) from public;
grant execute on function public.stub_checkout_create_paid_order(text, text, jsonb, text, integer, text) to service_role;
