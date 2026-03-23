create table if not exists public.storefront_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  session_key text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent text,
  referrer text,
  entry_path text,
  country_code text,
  device_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, session_key)
);

create table if not exists public.storefront_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  session_id uuid not null references public.storefront_sessions(id) on delete cascade,
  idempotency_key text,
  event_type text not null,
  path text,
  product_id uuid references public.products(id) on delete set null,
  cart_id uuid references public.customer_carts(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  occurred_at timestamptz not null default now(),
  value_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.storefront_daily_rollups (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  metric_date date not null,
  visitors integer not null default 0,
  sessions integer not null default 0,
  pageviews integer not null default 0,
  product_views integer not null default 0,
  add_to_cart integer not null default 0,
  checkout_started integer not null default 0,
  checkout_completed integer not null default 0,
  revenue_cents integer not null default 0,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, metric_date)
);

create index if not exists idx_storefront_sessions_store_last_seen
  on public.storefront_sessions(store_id, last_seen_at desc);

create index if not exists idx_storefront_events_store_occurred
  on public.storefront_events(store_id, occurred_at desc);

create index if not exists idx_storefront_events_session_occurred
  on public.storefront_events(session_id, occurred_at desc);

create unique index if not exists idx_storefront_events_store_idempotency
  on public.storefront_events(store_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_storefront_daily_rollups_store_date
  on public.storefront_daily_rollups(store_id, metric_date desc);

drop trigger if exists storefront_sessions_set_updated_at on public.storefront_sessions;
create trigger storefront_sessions_set_updated_at
before update on public.storefront_sessions
for each row execute function public.set_updated_at();

drop trigger if exists storefront_daily_rollups_set_updated_at on public.storefront_daily_rollups;
create trigger storefront_daily_rollups_set_updated_at
before update on public.storefront_daily_rollups
for each row execute function public.set_updated_at();

alter table public.storefront_sessions enable row level security;
alter table public.storefront_events enable row level security;
alter table public.storefront_daily_rollups enable row level security;

drop policy if exists storefront_sessions_store_member_read on public.storefront_sessions;
create policy storefront_sessions_store_member_read on public.storefront_sessions
for select
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = storefront_sessions.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
);

drop policy if exists storefront_events_store_member_read on public.storefront_events;
create policy storefront_events_store_member_read on public.storefront_events
for select
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = storefront_events.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
);

drop policy if exists storefront_daily_rollups_store_member_read on public.storefront_daily_rollups;
create policy storefront_daily_rollups_store_member_read on public.storefront_daily_rollups
for select
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = storefront_daily_rollups.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
);
