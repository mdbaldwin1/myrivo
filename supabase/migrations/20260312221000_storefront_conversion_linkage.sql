alter table public.customer_carts
  add column if not exists analytics_session_id uuid references public.storefront_sessions(id) on delete set null,
  add column if not exists analytics_session_key text;

alter table public.storefront_checkout_sessions
  add column if not exists analytics_session_id uuid references public.storefront_sessions(id) on delete set null,
  add column if not exists source_cart_id uuid references public.customer_carts(id) on delete set null;

alter table public.orders
  add column if not exists analytics_session_id uuid references public.storefront_sessions(id) on delete set null,
  add column if not exists analytics_session_key text,
  add column if not exists source_cart_id uuid references public.customer_carts(id) on delete set null,
  add column if not exists storefront_checkout_session_id uuid references public.storefront_checkout_sessions(id) on delete set null;

create index if not exists idx_customer_carts_storefront_session_id
  on public.customer_carts(analytics_session_id);

create index if not exists idx_storefront_checkout_sessions_analytics_session_id
  on public.storefront_checkout_sessions(analytics_session_id);

create index if not exists idx_orders_analytics_session_id
  on public.orders(analytics_session_id);

create index if not exists idx_orders_source_cart_id
  on public.orders(source_cart_id);
