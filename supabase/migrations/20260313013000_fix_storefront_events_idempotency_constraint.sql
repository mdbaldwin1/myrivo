update public.storefront_events
set idempotency_key = 'evt_' || replace(gen_random_uuid()::text, '-', '')
where idempotency_key is null or btrim(idempotency_key) = '';

drop index if exists public.idx_storefront_events_store_idempotency;

alter table public.storefront_events
  alter column idempotency_key set not null;

create unique index if not exists idx_storefront_events_store_idempotency
  on public.storefront_events(store_id, idempotency_key);
