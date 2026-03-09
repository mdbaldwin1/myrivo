create table if not exists public.store_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  support_email text,
  fulfillment_message text,
  shipping_policy text,
  return_policy text,
  announcement text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger store_settings_set_updated_at
before update on public.store_settings
for each row execute function public.set_updated_at();

alter table public.store_settings enable row level security;

create policy store_settings_owner_all on public.store_settings
for all
using (
  exists (
    select 1 from public.stores s
    where s.id = store_settings.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = store_settings.store_id
      and s.owner_user_id = auth.uid()
  )
);

create policy store_settings_public_read on public.store_settings
for select
using (
  exists (
    select 1 from public.stores s
    where s.id = store_settings.store_id
      and s.status = 'active'
  )
);
