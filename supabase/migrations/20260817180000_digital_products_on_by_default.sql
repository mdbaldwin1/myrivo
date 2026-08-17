-- Digital products ship on for every store.
--
-- Enablement previously required two switches: the billing plan had to mark
-- the store eligible, and the store itself had to be turned on, with a missing
-- flag row meaning off. That was a staged-rollout shape for a feature that is
-- now generally available, and it meant a per-store chore before anyone could
-- sell a file.
--
-- What remains is a single opt-out: a store row set to false disables digital
-- products for that store without a deploy. Absent a row, the feature is on.

alter table public.store_feature_flags
  alter column digital_products set default true;

insert into public.store_feature_flags (store_id, digital_products)
select store.id, true
from public.stores store
on conflict (store_id) do update
  set digital_products = true,
      updated_at = now()
  where public.store_feature_flags.digital_products is distinct from true;

create or replace function public.is_store_digital_products_enabled(
  p_store_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select store_flags.digital_products
    from public.store_feature_flags store_flags
    where store_flags.store_id = p_store_id
  ), true)
$$;

revoke all on function public.is_store_digital_products_enabled(uuid)
  from public, anon, authenticated;
grant execute on function public.is_store_digital_products_enabled(uuid)
  to service_role;
