create table if not exists public.storefront_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  store_slug text not null,
  customer_email text not null,
  promo_code text,
  items jsonb not null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  order_id uuid references public.orders(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_storefront_checkout_sessions_store_id_status
  on public.storefront_checkout_sessions(store_id, status);

create index if not exists idx_storefront_checkout_sessions_store_slug_created_at
  on public.storefront_checkout_sessions(store_slug, created_at desc);

create unique index if not exists idx_orders_stripe_payment_intent_unique
  on public.orders(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create trigger storefront_checkout_sessions_set_updated_at
before update on public.storefront_checkout_sessions
for each row execute function public.set_updated_at();

alter table public.storefront_checkout_sessions enable row level security;
