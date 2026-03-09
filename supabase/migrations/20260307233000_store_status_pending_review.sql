alter table public.stores drop constraint if exists stores_status_check;

alter table public.stores
  add constraint stores_status_check
  check (status in ('draft', 'pending_review', 'active', 'suspended'));
