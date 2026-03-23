create table if not exists public.store_privacy_profiles (
  store_id uuid primary key references public.stores(id) on delete cascade,
  notice_at_collection_enabled boolean not null default true,
  checkout_notice_enabled boolean not null default true,
  newsletter_notice_enabled boolean not null default true,
  review_notice_enabled boolean not null default true,
  show_california_notice boolean not null default false,
  show_do_not_sell_link boolean not null default false,
  privacy_contact_email text,
  privacy_rights_email text,
  privacy_contact_name text,
  collection_notice_addendum_markdown text not null default '',
  california_notice_markdown text not null default '',
  do_not_sell_markdown text not null default '',
  request_page_intro_markdown text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_store_privacy_profiles_rights_email
  on public.store_privacy_profiles (privacy_rights_email);

drop trigger if exists store_privacy_profiles_set_updated_at on public.store_privacy_profiles;
create trigger store_privacy_profiles_set_updated_at
before update on public.store_privacy_profiles
for each row execute function public.set_updated_at();

alter table public.store_privacy_profiles enable row level security;

drop policy if exists store_privacy_profiles_public_read on public.store_privacy_profiles;
create policy store_privacy_profiles_public_read on public.store_privacy_profiles
for select
using (
  exists (
    select 1
    from public.stores s
    where s.id = store_privacy_profiles.store_id
      and s.status = 'active'
  )
);

drop policy if exists store_privacy_profiles_owner_admin_manage on public.store_privacy_profiles;
create policy store_privacy_profiles_owner_admin_manage on public.store_privacy_profiles
for all
using (
  exists (
    select 1
    from public.stores s
    where s.id = store_privacy_profiles.store_id
      and s.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_privacy_profiles.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.stores s
    where s.id = store_privacy_profiles.store_id
      and s.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_privacy_profiles.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
);

insert into public.store_privacy_profiles (store_id)
select s.id
from public.stores s
on conflict (store_id) do nothing;

create table if not exists public.store_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  email text not null,
  full_name text,
  request_type text not null check (request_type in ('access', 'deletion', 'correction', 'know', 'opt_out_sale_share')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'closed')),
  source text not null default 'privacy_page' check (source in ('privacy_page', 'support', 'manual')),
  details text,
  metadata_json jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_store_privacy_requests_store_created
  on public.store_privacy_requests (store_id, created_at desc);

create index if not exists idx_store_privacy_requests_status
  on public.store_privacy_requests (store_id, status);

drop trigger if exists store_privacy_requests_set_updated_at on public.store_privacy_requests;
create trigger store_privacy_requests_set_updated_at
before update on public.store_privacy_requests
for each row execute function public.set_updated_at();

alter table public.store_privacy_requests enable row level security;

drop policy if exists store_privacy_requests_public_insert on public.store_privacy_requests;
create policy store_privacy_requests_public_insert on public.store_privacy_requests
for insert
with check (
  exists (
    select 1
    from public.stores s
    where s.id = store_privacy_requests.store_id
      and s.status = 'active'
  )
);

drop policy if exists store_privacy_requests_owner_admin_read on public.store_privacy_requests;
create policy store_privacy_requests_owner_admin_read on public.store_privacy_requests
for select
using (
  exists (
    select 1
    from public.stores s
    where s.id = store_privacy_requests.store_id
      and s.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_privacy_requests.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists store_privacy_requests_owner_admin_update on public.store_privacy_requests;
create policy store_privacy_requests_owner_admin_update on public.store_privacy_requests
for update
using (
  exists (
    select 1
    from public.stores s
    where s.id = store_privacy_requests.store_id
      and s.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_privacy_requests.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.stores s
    where s.id = store_privacy_requests.store_id
      and s.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_privacy_requests.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
);
