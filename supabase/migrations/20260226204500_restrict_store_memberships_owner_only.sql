alter table public.store_memberships
  drop constraint if exists store_memberships_owner_only;

alter table public.store_memberships
  add constraint store_memberships_owner_only
  check (role = 'owner');
