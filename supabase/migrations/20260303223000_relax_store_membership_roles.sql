do $$
begin
  if to_regclass('public.store_memberships') is not null then
    alter table public.store_memberships
      drop constraint if exists store_memberships_owner_only;
  end if;
end $$;
