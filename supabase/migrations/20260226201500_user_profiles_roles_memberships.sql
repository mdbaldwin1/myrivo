do $$
begin
  if not exists (select 1 from pg_type where typname = 'global_user_role') then
    create type public.global_user_role as enum ('user', 'platform_admin', 'support');
  end if;

  if not exists (select 1 from pg_type where typname = 'store_member_role') then
    create type public.store_member_role as enum ('owner', 'admin', 'staff');
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create table if not exists public.store_customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  email text not null,
  status text not null default 'active' check (status in ('active', 'blocked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, email)
);

create unique index if not exists idx_store_customers_store_auth_user_unique
  on public.store_customers(store_id, auth_user_id)
  where auth_user_id is not null;

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create trigger store_memberships_set_updated_at
before update on public.store_memberships
for each row execute function public.set_updated_at();

create trigger store_customers_set_updated_at
before update on public.store_customers
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.user_profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_auth_user_profile();

insert into public.user_profiles (id, email)
select u.id, u.email
from auth.users u
on conflict (id) do nothing;

insert into public.store_memberships (store_id, user_id, role, status)
select s.id, s.owner_user_id, 'owner'::public.store_member_role, 'active'
from public.stores s
on conflict (store_id, user_id) do update set
  role = excluded.role,
  status = excluded.status,
  updated_at = now();

alter table public.user_profiles enable row level security;
alter table public.store_memberships enable row level security;
alter table public.store_customers enable row level security;

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
    select 1 from public.stores s
    where s.id = store_memberships.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = store_memberships.store_id
      and s.owner_user_id = auth.uid()
  )
);

drop policy if exists store_customers_owner_all on public.store_customers;
create policy store_customers_owner_all on public.store_customers
for all
using (
  exists (
    select 1 from public.stores s
    where s.id = store_customers.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = store_customers.store_id
      and s.owner_user_id = auth.uid()
  )
);

drop policy if exists store_customers_self_read on public.store_customers;
create policy store_customers_self_read on public.store_customers
for select
using (auth_user_id = auth.uid());
