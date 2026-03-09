create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_events_store_id on public.audit_events(store_id);
create index if not exists idx_audit_events_actor_user_id on public.audit_events(actor_user_id);
create index if not exists idx_audit_events_created_at on public.audit_events(created_at desc);

alter table public.audit_events enable row level security;

create policy audit_events_owner_read on public.audit_events
for select
using (
  store_id is not null
  and exists (
    select 1 from public.stores s
    where s.id = audit_events.store_id
      and s.owner_user_id = auth.uid()
  )
);
