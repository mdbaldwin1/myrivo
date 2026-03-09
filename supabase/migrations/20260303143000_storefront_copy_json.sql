alter table public.store_settings
add column if not exists storefront_copy_json jsonb not null default '{}'::jsonb;

update public.store_settings
set storefront_copy_json = '{}'::jsonb
where storefront_copy_json is null;

insert into public.store_settings (store_id, storefront_copy_json)
select s.id, '{}'::jsonb
from public.stores s
where not exists (
  select 1
  from public.store_settings ss
  where ss.store_id = s.id
);
