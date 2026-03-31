create table if not exists public.back_in_stock_alerts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  product_variant_id uuid not null references public.product_variants(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  source text not null default 'storefront_product_detail',
  alert_count integer not null default 0 check (alert_count >= 0),
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  last_alert_sent_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_back_in_stock_alerts_store_id on public.back_in_stock_alerts(store_id);
create index if not exists idx_back_in_stock_alerts_variant_id on public.back_in_stock_alerts(product_variant_id);
create index if not exists idx_back_in_stock_alerts_status on public.back_in_stock_alerts(status);
create index if not exists idx_back_in_stock_alerts_requested_at on public.back_in_stock_alerts(requested_at desc);
create unique index if not exists idx_back_in_stock_alerts_store_variant_email_unique
  on public.back_in_stock_alerts(store_id, product_variant_id, lower(email));

drop trigger if exists back_in_stock_alerts_set_updated_at on public.back_in_stock_alerts;
create trigger back_in_stock_alerts_set_updated_at
before update on public.back_in_stock_alerts
for each row execute function public.set_updated_at();

alter table public.back_in_stock_alerts enable row level security;

create policy back_in_stock_alerts_store_member_read on public.back_in_stock_alerts
for select
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = back_in_stock_alerts.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1
    from public.stores s
    where s.id = back_in_stock_alerts.store_id
      and s.owner_user_id = auth.uid()
  )
);

create policy back_in_stock_alerts_store_admin_manage on public.back_in_stock_alerts
for all
using (public.can_manage_store_membership_for_store(store_id))
with check (public.can_manage_store_membership_for_store(store_id));
