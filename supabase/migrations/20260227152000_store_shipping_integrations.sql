create table if not exists public.store_integrations (
  store_id uuid primary key references public.stores(id) on delete cascade,
  shipping_provider text not null default 'none' check (shipping_provider in ('none', 'easypost')),
  shipping_api_key text,
  shipping_webhook_secret text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger store_integrations_set_updated_at
before update on public.store_integrations
for each row execute function public.set_updated_at();

alter table public.store_integrations enable row level security;

create policy store_integrations_owner_all on public.store_integrations
for all
using (
  exists (
    select 1 from public.stores s
    where s.id = store_integrations.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = store_integrations.store_id
      and s.owner_user_id = auth.uid()
  )
);
