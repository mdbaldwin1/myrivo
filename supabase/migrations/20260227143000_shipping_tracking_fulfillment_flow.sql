-- Expand fulfillment lifecycle and add shipment tracking metadata.

alter table public.orders
  add column if not exists carrier text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists shipment_provider text,
  add column if not exists shipment_tracker_id text,
  add column if not exists shipment_status text,
  add column if not exists last_tracking_sync_at timestamptz,
  add column if not exists delivered_at timestamptz;

update public.orders
set fulfillment_status = 'packing'
where fulfillment_status = 'fulfillment_in_progress';

update public.orders
set fulfillment_status = 'delivered',
    delivered_at = coalesce(delivered_at, fulfilled_at, now())
where fulfillment_status = 'fulfilled';

alter table public.orders
  drop constraint if exists orders_fulfillment_status_check;

alter table public.orders
  add constraint orders_fulfillment_status_check
  check (fulfillment_status in ('pending_fulfillment', 'packing', 'shipped', 'delivered'));

create index if not exists idx_orders_shipment_tracker_id on public.orders(shipment_tracker_id);
create index if not exists idx_orders_tracking_number on public.orders(tracking_number);
create index if not exists idx_orders_fulfillment_status on public.orders(fulfillment_status);
