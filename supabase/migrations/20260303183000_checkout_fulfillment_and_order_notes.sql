alter table public.store_settings
  add column if not exists checkout_enable_local_pickup boolean not null default false,
  add column if not exists checkout_local_pickup_label text,
  add column if not exists checkout_local_pickup_fee_cents integer not null default 0 check (checkout_local_pickup_fee_cents >= 0),
  add column if not exists checkout_enable_flat_rate_shipping boolean not null default true,
  add column if not exists checkout_flat_rate_shipping_label text,
  add column if not exists checkout_flat_rate_shipping_fee_cents integer not null default 0 check (checkout_flat_rate_shipping_fee_cents >= 0),
  add column if not exists checkout_allow_order_note boolean not null default false,
  add column if not exists checkout_order_note_prompt text;

alter table public.orders
  add column if not exists customer_first_name text,
  add column if not exists customer_last_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_note text,
  add column if not exists fulfillment_method text check (fulfillment_method in ('pickup', 'shipping')),
  add column if not exists fulfillment_label text,
  add column if not exists shipping_fee_cents integer not null default 0 check (shipping_fee_cents >= 0);

alter table public.storefront_checkout_sessions
  add column if not exists customer_first_name text,
  add column if not exists customer_last_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_note text,
  add column if not exists fulfillment_method text check (fulfillment_method in ('pickup', 'shipping')),
  add column if not exists fulfillment_label text,
  add column if not exists shipping_fee_cents integer not null default 0 check (shipping_fee_cents >= 0);

update public.store_settings
set
  checkout_local_pickup_label = coalesce(nullif(trim(checkout_local_pickup_label), ''), 'Porch pickup'),
  checkout_flat_rate_shipping_label = coalesce(nullif(trim(checkout_flat_rate_shipping_label), ''), 'Shipped (flat fee)'),
  checkout_order_note_prompt = coalesce(
    nullif(trim(checkout_order_note_prompt), ''),
    'If you have any questions, comments, or concerns about your order, leave a note below.'
  );

insert into public.store_settings (
  store_id,
  checkout_enable_local_pickup,
  checkout_local_pickup_label,
  checkout_local_pickup_fee_cents,
  checkout_enable_flat_rate_shipping,
  checkout_flat_rate_shipping_label,
  checkout_flat_rate_shipping_fee_cents,
  checkout_allow_order_note,
  checkout_order_note_prompt
)
select
  s.id,
  false,
  'Porch pickup',
  0,
  true,
  'Shipped (flat fee)',
  0,
  false,
  'If you have any questions, comments, or concerns about your order, leave a note below.'
from public.stores s
left join public.store_settings ss on ss.store_id = s.id
where ss.store_id is null;
