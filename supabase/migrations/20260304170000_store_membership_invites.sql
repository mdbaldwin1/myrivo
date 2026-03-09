create table if not exists public.store_membership_invites (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  email text not null,
  role public.store_member_role not null check (role in ('admin', 'staff', 'customer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  token_hash text not null,
  invited_by_user_id uuid not null references auth.users(id) on delete restrict,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_store_membership_invites_store_id on public.store_membership_invites(store_id);
create index if not exists idx_store_membership_invites_email on public.store_membership_invites(email);
create index if not exists idx_store_membership_invites_status on public.store_membership_invites(status);

create unique index if not exists uniq_store_membership_invites_pending_email
  on public.store_membership_invites(store_id, lower(email))
  where status = 'pending';

drop trigger if exists store_membership_invites_set_updated_at on public.store_membership_invites;
create trigger store_membership_invites_set_updated_at
before update on public.store_membership_invites
for each row execute function public.set_updated_at();

alter table public.store_membership_invites enable row level security;

drop policy if exists membership_invites_manage on public.store_membership_invites;
create policy membership_invites_manage on public.store_membership_invites
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_membership_invites.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_membership_invites.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_membership_invites.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_membership_invites.store_id
      and s.owner_user_id = auth.uid()
  )
);

