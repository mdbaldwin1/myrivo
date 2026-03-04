do $$
begin
  if exists (select 1 from pg_type where typname = 'global_user_role') then
    if exists (
      select 1
      from pg_enum
      where enumtypid = 'public.global_user_role'::regtype
        and enumlabel = 'platform_admin'
    ) then
      alter type public.global_user_role rename value 'platform_admin' to 'admin';
    end if;

    if not exists (
      select 1
      from pg_enum
      where enumtypid = 'public.global_user_role'::regtype
        and enumlabel = 'support'
    ) then
      alter type public.global_user_role add value 'support';
    end if;
  else
    create type public.global_user_role as enum ('user', 'admin', 'support');
  end if;

  if exists (select 1 from pg_type where typname = 'store_member_role') then
    if not exists (
      select 1
      from pg_enum
      where enumtypid = 'public.store_member_role'::regtype
        and enumlabel = 'customer'
    ) then
      alter type public.store_member_role add value 'customer';
    end if;
  else
    create type public.store_member_role as enum ('owner', 'admin', 'staff', 'customer');
  end if;
end $$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  global_role public.global_user_role not null default 'user',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.store_member_role not null,
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  permissions_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create table if not exists public.store_pickup_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  pickup_enabled boolean not null default false,
  selection_mode text not null default 'buyer_select' check (selection_mode in ('buyer_select', 'hidden_nearest')),
  eligibility_radius_miles integer not null default 100 check (eligibility_radius_miles between 1 and 1000),
  lead_time_hours integer not null default 48 check (lead_time_hours between 0 and 720),
  slot_interval_minutes integer not null default 60 check (slot_interval_minutes in (15, 30, 60, 120)),
  show_pickup_times boolean not null default true,
  timezone text not null default 'America/New_York',
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pickup_locations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state_region text not null,
  postal_code text not null,
  country_code text not null default 'US',
  latitude double precision,
  longitude double precision,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pickup_locations_store_id on public.pickup_locations(store_id);
create index if not exists idx_pickup_locations_store_active on public.pickup_locations(store_id, is_active);

create table if not exists public.pickup_location_hours (
  id uuid primary key default gen_random_uuid(),
  pickup_location_id uuid not null references public.pickup_locations(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (opens_at < closes_at)
);

create index if not exists idx_pickup_location_hours_location_id on public.pickup_location_hours(pickup_location_id);

create table if not exists public.pickup_blackout_dates (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  pickup_location_id uuid references public.pickup_locations(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create index if not exists idx_pickup_blackout_dates_store_id on public.pickup_blackout_dates(store_id);

alter table public.orders
  add column if not exists pickup_location_id uuid references public.pickup_locations(id) on delete set null,
  add column if not exists pickup_location_snapshot_json jsonb,
  add column if not exists pickup_window_start_at timestamptz,
  add column if not exists pickup_window_end_at timestamptz,
  add column if not exists pickup_timezone text;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists store_memberships_set_updated_at on public.store_memberships;
create trigger store_memberships_set_updated_at
before update on public.store_memberships
for each row execute function public.set_updated_at();

drop trigger if exists store_pickup_settings_set_updated_at on public.store_pickup_settings;
create trigger store_pickup_settings_set_updated_at
before update on public.store_pickup_settings
for each row execute function public.set_updated_at();

drop trigger if exists pickup_locations_set_updated_at on public.pickup_locations;
create trigger pickup_locations_set_updated_at
before update on public.pickup_locations
for each row execute function public.set_updated_at();

drop trigger if exists pickup_location_hours_set_updated_at on public.pickup_location_hours;
create trigger pickup_location_hours_set_updated_at
before update on public.pickup_location_hours
for each row execute function public.set_updated_at();

drop trigger if exists pickup_blackout_dates_set_updated_at on public.pickup_blackout_dates;
create trigger pickup_blackout_dates_set_updated_at
before update on public.pickup_blackout_dates
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.store_memberships enable row level security;
alter table public.store_pickup_settings enable row level security;
alter table public.pickup_locations enable row level security;
alter table public.pickup_location_hours enable row level security;
alter table public.pickup_blackout_dates enable row level security;

drop policy if exists user_profiles_self_read on public.user_profiles;
create policy user_profiles_self_read on public.user_profiles
for select
using (id = auth.uid());

drop policy if exists user_profiles_self_update on public.user_profiles;
create policy user_profiles_self_update on public.user_profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists memberships_self_read on public.store_memberships;
create policy memberships_self_read on public.store_memberships
for select
using (user_id = auth.uid());

drop policy if exists memberships_owner_manage on public.store_memberships;
create policy memberships_owner_manage on public.store_memberships
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_memberships.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_memberships.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_memberships.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_memberships.store_id
      and s.owner_user_id = auth.uid()
  )
);

drop policy if exists pickup_settings_manage on public.store_pickup_settings;
create policy pickup_settings_manage on public.store_pickup_settings
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_pickup_settings.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_pickup_settings.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_pickup_settings.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_pickup_settings.store_id
      and s.owner_user_id = auth.uid()
  )
);

drop policy if exists pickup_locations_manage on public.pickup_locations;
create policy pickup_locations_manage on public.pickup_locations
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = pickup_locations.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = pickup_locations.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = pickup_locations.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = pickup_locations.store_id
      and s.owner_user_id = auth.uid()
  )
);

drop policy if exists pickup_hours_manage on public.pickup_location_hours;
create policy pickup_hours_manage on public.pickup_location_hours
for all
using (
  exists (
    select 1
    from public.pickup_locations pl
    join public.store_memberships sm on sm.store_id = pl.store_id
    where pl.id = pickup_location_hours.pickup_location_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1
    from public.pickup_locations pl
    join public.stores s on s.id = pl.store_id
    where pl.id = pickup_location_hours.pickup_location_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.pickup_locations pl
    join public.store_memberships sm on sm.store_id = pl.store_id
    where pl.id = pickup_location_hours.pickup_location_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1
    from public.pickup_locations pl
    join public.stores s on s.id = pl.store_id
    where pl.id = pickup_location_hours.pickup_location_id
      and s.owner_user_id = auth.uid()
  )
);

drop policy if exists pickup_blackouts_manage on public.pickup_blackout_dates;
create policy pickup_blackouts_manage on public.pickup_blackout_dates
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = pickup_blackout_dates.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = pickup_blackout_dates.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = pickup_blackout_dates.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = pickup_blackout_dates.store_id
      and s.owner_user_id = auth.uid()
  )
);
