-- Keep the database checkout boundary aligned with the platform-owned digital
-- delivery consent and personal-use license versions. Existing attempts remain
-- readable/retryable; newly inserted or materially edited digital snapshots
-- must carry the configured policy evidence.

create table if not exists public.digital_checkout_policy_versions (
  singleton boolean primary key default true check (singleton),
  consent_version text not null check (char_length(trim(consent_version)) > 0),
  license_version text not null check (char_length(trim(license_version)) > 0),
  updated_at timestamptz not null default now()
);

insert into public.digital_checkout_policy_versions(
  singleton,
  consent_version,
  license_version
) values (
  true,
  'immediate-delivery-v1',
  'personal-use-v1'
) on conflict (singleton) do nothing;

alter table public.digital_checkout_policy_versions enable row level security;
revoke all on table public.digital_checkout_policy_versions
from public, anon, authenticated;

create or replace function public.enforce_digital_checkout_policy_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_policy public.digital_checkout_policy_versions%rowtype;
  v_contains_digital boolean;
begin
  v_contains_digital := coalesce(
    new.checkout_composition in ('digital_only', 'mixed'),
    false
  )
    or exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(new.items) = 'array' then new.items
          else '[]'::jsonb
        end
      ) item
      where item ->> 'productType' = 'digital'
    );

  if not v_contains_digital then
    return new;
  end if;

  select * into v_policy
  from public.digital_checkout_policy_versions policy
  where policy.singleton = true;
  if not found then
    raise exception 'Digital checkout policy is not configured';
  end if;

  if new.digital_consent_version is distinct from v_policy.consent_version
     or new.digital_license_version is distinct from v_policy.license_version
     or new.digital_consent_accepted_at is null
     or new.digital_consent_accepted_at > statement_timestamp() + interval '5 minutes'
  then
    raise exception 'Digital checkout consent and license snapshot is invalid';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_digital_checkout_policy_snapshot
on public.storefront_checkout_sessions;
create trigger enforce_digital_checkout_policy_snapshot
before insert or update of
  items,
  checkout_composition,
  digital_consent_version,
  digital_consent_accepted_at,
  digital_license_version
on public.storefront_checkout_sessions
for each row execute function public.enforce_digital_checkout_policy_snapshot();

revoke all on function public.enforce_digital_checkout_policy_snapshot()
from public, anon, authenticated, service_role;

revoke all on function public.create_or_reuse_storefront_checkout_attempt(uuid, text, text, jsonb)
from public, anon, authenticated;
grant execute on function public.create_or_reuse_storefront_checkout_attempt(uuid, text, text, jsonb)
to service_role;
