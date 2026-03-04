alter table public.stores
  add column if not exists mode text not null default 'live' check (mode in ('sandbox', 'live')),
  add column if not exists default_pickup_radius_miles integer not null default 100 check (default_pickup_radius_miles between 1 and 500),
  add column if not exists white_label_enabled boolean not null default false,
  add column if not exists white_label_brand_name text,
  add column if not exists white_label_favicon_path text;

alter table public.storefront_checkout_sessions
  add column if not exists pickup_location_id uuid references public.pickup_locations(id) on delete set null,
  add column if not exists pickup_location_snapshot_json jsonb,
  add column if not exists pickup_window_start_at timestamptz,
  add column if not exists pickup_window_end_at timestamptz,
  add column if not exists pickup_timezone text;

create table if not exists public.store_domains (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  domain text not null unique,
  is_primary boolean not null default false,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'failed')),
  verification_token text,
  last_verification_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, domain)
);

create index if not exists idx_store_domains_store_id on public.store_domains(store_id);

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  default_shipping_address_json jsonb not null default '{}'::jsonb,
  preferences_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.customer_saved_stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, store_id)
);

create table if not exists public.customer_saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  product_variant_id uuid references public.product_variants(id) on delete cascade,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (product_id is not null or product_variant_id is not null),
  unique (user_id, store_id, product_id, product_variant_id)
);

create table if not exists public.customer_carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ordered', 'abandoned')),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.customer_carts(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_variant_id uuid references public.product_variants(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0 and quantity <= 99),
  unit_price_snapshot_cents integer not null default 0 check (unit_price_snapshot_cents >= 0),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id, product_variant_id),
  check (product_id is not null or product_variant_id is not null)
);

create table if not exists public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  monthly_price_cents integer not null default 0 check (monthly_price_cents >= 0),
  transaction_fee_bps integer not null default 0 check (transaction_fee_bps between 0 and 10000),
  transaction_fee_fixed_cents integer not null default 0 check (transaction_fee_fixed_cents >= 0),
  feature_flags_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_billing_profiles (
  store_id uuid primary key references public.stores(id) on delete cascade,
  billing_plan_id uuid references public.billing_plans(id) on delete set null,
  fee_override_bps integer,
  fee_override_fixed_cents integer,
  billing_mode text not null default 'platform' check (billing_mode in ('platform', 'manual')),
  test_mode_enabled boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_fee_breakdowns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  plan_key text,
  fee_bps integer not null default 0 check (fee_bps between 0 and 10000),
  fee_fixed_cents integer not null default 0 check (fee_fixed_cents >= 0),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  net_payout_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  event_type text not null,
  source text,
  payload_json jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

insert into public.billing_plans (key, name, monthly_price_cents, transaction_fee_bps, transaction_fee_fixed_cents, feature_flags_json)
values
  ('starter', 'Starter', 0, 350, 0, '{"prioritySupport": false, "customDomain": false}'::jsonb),
  ('growth', 'Growth', 4900, 200, 0, '{"prioritySupport": true, "customDomain": true}'::jsonb),
  ('scale', 'Scale', 14900, 100, 0, '{"prioritySupport": true, "customDomain": true, "whiteLabel": true}'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  monthly_price_cents = excluded.monthly_price_cents,
  transaction_fee_bps = excluded.transaction_fee_bps,
  transaction_fee_fixed_cents = excluded.transaction_fee_fixed_cents,
  feature_flags_json = excluded.feature_flags_json,
  active = true;

insert into public.store_billing_profiles (store_id, billing_plan_id)
select s.id, bp.id
from public.stores s
join public.billing_plans bp on bp.key = 'starter'
on conflict (store_id) do nothing;

create index if not exists idx_customer_saved_stores_user_id on public.customer_saved_stores(user_id);
create index if not exists idx_customer_saved_items_user_id on public.customer_saved_items(user_id);
create index if not exists idx_customer_saved_items_store_id on public.customer_saved_items(store_id);
create index if not exists idx_customer_carts_user_store on public.customer_carts(user_id, store_id);
create unique index if not exists idx_customer_carts_active_unique
  on public.customer_carts(user_id, store_id)
  where status = 'active';
create index if not exists idx_customer_cart_items_cart_id on public.customer_cart_items(cart_id);
create index if not exists idx_billing_events_store_id on public.billing_events(store_id);
create index if not exists idx_order_fee_breakdowns_store_id on public.order_fee_breakdowns(store_id);

alter table public.store_domains enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.customer_saved_stores enable row level security;
alter table public.customer_saved_items enable row level security;
alter table public.customer_carts enable row level security;
alter table public.customer_cart_items enable row level security;
alter table public.billing_plans enable row level security;
alter table public.store_billing_profiles enable row level security;
alter table public.order_fee_breakdowns enable row level security;
alter table public.billing_events enable row level security;

drop trigger if exists store_domains_set_updated_at on public.store_domains;
create trigger store_domains_set_updated_at
before update on public.store_domains
for each row execute function public.set_updated_at();

drop trigger if exists customer_profiles_set_updated_at on public.customer_profiles;
create trigger customer_profiles_set_updated_at
before update on public.customer_profiles
for each row execute function public.set_updated_at();

drop trigger if exists customer_carts_set_updated_at on public.customer_carts;
create trigger customer_carts_set_updated_at
before update on public.customer_carts
for each row execute function public.set_updated_at();

drop trigger if exists customer_cart_items_set_updated_at on public.customer_cart_items;
create trigger customer_cart_items_set_updated_at
before update on public.customer_cart_items
for each row execute function public.set_updated_at();

drop trigger if exists billing_plans_set_updated_at on public.billing_plans;
create trigger billing_plans_set_updated_at
before update on public.billing_plans
for each row execute function public.set_updated_at();

drop trigger if exists store_billing_profiles_set_updated_at on public.store_billing_profiles;
create trigger store_billing_profiles_set_updated_at
before update on public.store_billing_profiles
for each row execute function public.set_updated_at();

-- Customer self access.
drop policy if exists customer_profiles_self_manage on public.customer_profiles;
create policy customer_profiles_self_manage on public.customer_profiles
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists customer_saved_stores_self_manage on public.customer_saved_stores;
create policy customer_saved_stores_self_manage on public.customer_saved_stores
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists customer_saved_items_self_manage on public.customer_saved_items;
create policy customer_saved_items_self_manage on public.customer_saved_items
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists customer_carts_self_manage on public.customer_carts;
create policy customer_carts_self_manage on public.customer_carts
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists customer_cart_items_self_manage on public.customer_cart_items;
create policy customer_cart_items_self_manage on public.customer_cart_items
for all
using (
  exists (
    select 1 from public.customer_carts cc
    where cc.id = customer_cart_items.cart_id
      and cc.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.customer_carts cc
    where cc.id = customer_cart_items.cart_id
      and cc.user_id = auth.uid()
  )
);

-- Merchant/store member management.
drop policy if exists store_domains_manage on public.store_domains;
create policy store_domains_manage on public.store_domains
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_domains.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_domains.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_domains.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_domains.store_id
      and s.owner_user_id = auth.uid()
  )
);

drop policy if exists billing_plans_admin_read on public.billing_plans;
create policy billing_plans_admin_read on public.billing_plans
for select
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.global_role in ('admin', 'support')
  )
);

drop policy if exists store_billing_profiles_manage on public.store_billing_profiles;
create policy store_billing_profiles_manage on public.store_billing_profiles
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_billing_profiles.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_billing_profiles.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_billing_profiles.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_billing_profiles.store_id
      and s.owner_user_id = auth.uid()
  )
);

drop policy if exists order_fee_breakdowns_manage on public.order_fee_breakdowns;
create policy order_fee_breakdowns_manage on public.order_fee_breakdowns
for select
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = order_fee_breakdowns.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = order_fee_breakdowns.store_id
      and s.owner_user_id = auth.uid()
  )
);

drop policy if exists billing_events_manage on public.billing_events;
create policy billing_events_manage on public.billing_events
for select
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = billing_events.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
  or exists (
    select 1 from public.stores s
    where s.id = billing_events.store_id
      and s.owner_user_id = auth.uid()
  )
);
