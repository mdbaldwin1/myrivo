create table if not exists public.order_shipping_delays (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'delay_detected' check (
    status in (
      'delay_detected',
      'customer_contact_required',
      'awaiting_customer_response',
      'delay_approved',
      'delay_rejected',
      'cancel_requested',
      'refund_required',
      'resolved'
    )
  ),
  reason_key text not null check (
    reason_key in (
      'inventory_shortfall',
      'supplier_delay',
      'production_delay',
      'carrier_disruption',
      'weather_or_emergency',
      'address_or_verification_issue',
      'fulfillment_capacity_issue',
      'other'
    )
  ),
  customer_path text not null check (
    customer_path in (
      'notify_only',
      'request_delay_approval',
      'offer_cancel_or_refund'
    )
  ),
  original_ship_promise text,
  revised_ship_date date,
  internal_note text,
  resolution_note text,
  metadata_json jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_order_shipping_delays_order_id_created_at
  on public.order_shipping_delays(order_id, created_at desc);

create index if not exists idx_order_shipping_delays_store_id_status
  on public.order_shipping_delays(store_id, status);

create unique index if not exists idx_order_shipping_delays_order_active
  on public.order_shipping_delays(order_id)
  where resolved_at is null and status <> 'resolved';

drop trigger if exists order_shipping_delays_set_updated_at on public.order_shipping_delays;
create trigger order_shipping_delays_set_updated_at
before update on public.order_shipping_delays
for each row execute function public.set_updated_at();

alter table public.order_shipping_delays enable row level security;

drop policy if exists order_shipping_delays_store_read on public.order_shipping_delays;
create policy order_shipping_delays_store_read on public.order_shipping_delays
for select
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = order_shipping_delays.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
);

drop policy if exists order_shipping_delays_store_insert on public.order_shipping_delays;
create policy order_shipping_delays_store_insert on public.order_shipping_delays
for insert
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = order_shipping_delays.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
);

drop policy if exists order_shipping_delays_store_update on public.order_shipping_delays;
create policy order_shipping_delays_store_update on public.order_shipping_delays
for update
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = order_shipping_delays.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
)
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = order_shipping_delays.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
);
