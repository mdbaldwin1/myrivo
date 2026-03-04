alter table public.store_settings
  add column if not exists email_capture_enabled boolean not null default false,
  add column if not exists email_capture_heading text,
  add column if not exists email_capture_description text,
  add column if not exists email_capture_success_message text;

create table if not exists public.store_email_subscribers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  email text not null,
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  source text not null default 'storefront',
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists store_email_subscribers_store_email_unique
  on public.store_email_subscribers (store_id, lower(email));

create index if not exists store_email_subscribers_store_status_created_idx
  on public.store_email_subscribers (store_id, status, created_at desc);

create trigger store_email_subscribers_set_updated_at
before update on public.store_email_subscribers
for each row execute function public.set_updated_at();

alter table public.store_email_subscribers enable row level security;

create policy store_email_subscribers_owner_all on public.store_email_subscribers
for all
using (
  exists (
    select 1 from public.stores s
    where s.id = store_email_subscribers.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = store_email_subscribers.store_id
      and s.owner_user_id = auth.uid()
  )
);

create policy store_email_subscribers_public_insert on public.store_email_subscribers
for insert
with check (
  exists (
    select 1
    from public.stores s
    left join public.store_settings ss on ss.store_id = s.id
    where s.id = store_email_subscribers.store_id
      and s.status = 'active'
      and coalesce(ss.email_capture_enabled, false) = true
  )
);

insert into public.store_settings (store_id, email_capture_enabled)
select s.id, false
from public.stores s
left join public.store_settings ss on ss.store_id = s.id
where ss.store_id is null;
