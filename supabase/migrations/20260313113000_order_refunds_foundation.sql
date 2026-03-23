create table if not exists public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  processed_by_user_id uuid references auth.users(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  reason_key text not null,
  reason_note text,
  customer_message text,
  status text not null default 'requested' check (status in ('requested', 'processing', 'succeeded', 'failed', 'cancelled')),
  stripe_refund_id text,
  metadata_json jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_order_refunds_order_id_created_at on public.order_refunds(order_id, created_at desc);
create index if not exists idx_order_refunds_store_id_status on public.order_refunds(store_id, status);

drop trigger if exists order_refunds_set_updated_at on public.order_refunds;
create trigger order_refunds_set_updated_at
before update on public.order_refunds
for each row execute function public.set_updated_at();

alter table public.order_refunds enable row level security;

drop policy if exists order_refunds_store_read on public.order_refunds;
create policy order_refunds_store_read on public.order_refunds
for select
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = order_refunds.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
);
