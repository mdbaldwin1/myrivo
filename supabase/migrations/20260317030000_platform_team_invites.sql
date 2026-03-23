create table if not exists public.platform_team_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.global_user_role not null check (role in ('admin', 'support')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  token_hash text not null unique,
  invited_by_user_id uuid not null references public.user_profiles(id) on delete cascade,
  accepted_by_user_id uuid references public.user_profiles(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_platform_team_invites_email on public.platform_team_invites(lower(email));
create index if not exists idx_platform_team_invites_status on public.platform_team_invites(status);

create unique index if not exists uniq_platform_team_invites_pending_email
  on public.platform_team_invites(lower(email))
  where status = 'pending';

drop trigger if exists platform_team_invites_set_updated_at on public.platform_team_invites;
create trigger platform_team_invites_set_updated_at
before update on public.platform_team_invites
for each row execute function public.set_updated_at();

alter table public.platform_team_invites enable row level security;

drop policy if exists platform_team_invites_admin_manage on public.platform_team_invites;
create policy platform_team_invites_admin_manage on public.platform_team_invites
for all
using (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.global_role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.global_role = 'admin'
  )
);

drop policy if exists platform_team_invites_support_read on public.platform_team_invites;
create policy platform_team_invites_support_read on public.platform_team_invites
for select
using (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.global_role in ('support', 'admin')
  )
);
