create or replace function public.can_manage_store_membership_for_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.stores s
    where s.id = target_store_id
      and s.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = target_store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  );
$$;

revoke all on function public.can_manage_store_membership_for_store(uuid) from public;
grant execute on function public.can_manage_store_membership_for_store(uuid) to authenticated;
grant execute on function public.can_manage_store_membership_for_store(uuid) to service_role;

drop policy if exists memberships_owner_manage on public.store_memberships;
create policy memberships_owner_manage on public.store_memberships
for all
using (public.can_manage_store_membership_for_store(store_id))
with check (public.can_manage_store_membership_for_store(store_id));
