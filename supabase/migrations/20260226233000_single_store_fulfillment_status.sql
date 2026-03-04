alter table public.orders
  drop constraint if exists orders_fulfillment_status_check;

update public.orders
set fulfillment_status = case fulfillment_status
  when 'unfulfilled' then 'pending_fulfillment'
  when 'processing' then 'fulfillment_in_progress'
  when 'shipped' then 'fulfilled'
  else fulfillment_status
end
where fulfillment_status in ('unfulfilled', 'processing', 'shipped');

alter table public.orders
  alter column fulfillment_status set default 'pending_fulfillment';

alter table public.orders
  drop constraint if exists orders_fulfillment_status_check;

alter table public.orders
  add constraint orders_fulfillment_status_check
  check (fulfillment_status in ('pending_fulfillment', 'fulfillment_in_progress', 'fulfilled'));
