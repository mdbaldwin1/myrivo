create table if not exists public.store_privacy_opt_outs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  email text not null,
  full_name text,
  state text not null default 'active' check (state in ('active', 'revoked')),
  source text not null default 'privacy_page' check (source in ('privacy_page', 'browser_signal', 'support', 'manual')),
  latest_request_id uuid references public.store_privacy_requests(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, email)
);

create index if not exists idx_store_privacy_opt_outs_store_state
  on public.store_privacy_opt_outs (store_id, state, updated_at desc);

create index if not exists idx_store_privacy_opt_outs_email
  on public.store_privacy_opt_outs (store_id, email);

drop trigger if exists store_privacy_opt_outs_set_updated_at on public.store_privacy_opt_outs;
create trigger store_privacy_opt_outs_set_updated_at
before update on public.store_privacy_opt_outs
for each row execute function public.set_updated_at();

alter table public.store_privacy_opt_outs enable row level security;

drop policy if exists store_privacy_opt_outs_owner_admin_read on public.store_privacy_opt_outs;
create policy store_privacy_opt_outs_owner_admin_read on public.store_privacy_opt_outs
for select
using (
  exists (
    select 1
    from public.stores s
    where s.id = store_privacy_opt_outs.store_id
      and s.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_privacy_opt_outs.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists store_privacy_opt_outs_owner_admin_manage on public.store_privacy_opt_outs;
create policy store_privacy_opt_outs_owner_admin_manage on public.store_privacy_opt_outs
for all
using (
  exists (
    select 1
    from public.stores s
    where s.id = store_privacy_opt_outs.store_id
      and s.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_privacy_opt_outs.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.stores s
    where s.id = store_privacy_opt_outs.store_id
      and s.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_privacy_opt_outs.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
);
