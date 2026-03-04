insert into public.store_memberships (store_id, user_id, role, status, permissions_json)
select
  s.id as store_id,
  s.owner_user_id as user_id,
  'owner'::public.store_member_role as role,
  'active' as status,
  jsonb_build_object('*', true) as permissions_json
from public.stores s
where not exists (
  select 1
  from public.store_memberships sm
  where sm.store_id = s.id
    and sm.user_id = s.owner_user_id
    and sm.role = 'owner'
    and sm.status = 'active'
)
on conflict (store_id, user_id) do update
set
  role = excluded.role,
  status = excluded.status,
  permissions_json = coalesce(public.store_memberships.permissions_json, '{}'::jsonb),
  updated_at = now();
