alter table public.stores
  add column if not exists has_launched_once boolean not null default false;

update public.stores
set has_launched_once = true
where status in ('live', 'offline', 'suspended', 'removed')
  and has_launched_once = false;
