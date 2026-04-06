alter table public.orders
  add column if not exists shipping_address_json jsonb;

alter table public.storefront_checkout_sessions
  add column if not exists shipping_address_json jsonb;
