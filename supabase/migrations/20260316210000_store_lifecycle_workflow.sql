alter table public.stores drop constraint if exists stores_status_check;

alter table public.stores
  add column if not exists status_reason_code text,
  add column if not exists status_reason_detail text;

update public.stores
set status = case
  when status = 'active' then 'live'
  else status
end;

alter table public.stores
  add constraint stores_status_check
  check (status in ('draft', 'pending_review', 'changes_requested', 'rejected', 'suspended', 'live', 'offline', 'removed'));
