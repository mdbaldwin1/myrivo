create table public.digital_products_release_approvals (
  id uuid primary key default gen_random_uuid(),
  release_version text not null,
  environment text not null check (environment in ('test', 'preview')),
  evidence_sha256 text not null check (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  provider_accepted_at timestamptz not null,
  security_reviewed_at timestamptz not null,
  code_reviewed_at timestamptz not null,
  ux_reviewed_at timestamptz not null,
  expires_at timestamptz not null,
  approved_by_user_id uuid not null references auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint digital_products_release_approvals_window check (expires_at > created_at)
);

alter table public.digital_products_release_approvals enable row level security;
revoke all on table public.digital_products_release_approvals from public, anon, authenticated;
create index digital_products_release_approvals_current_idx
  on public.digital_products_release_approvals(expires_at desc)
  where revoked_at is null;

create or replace function public.enforce_digital_products_release_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if session_user <> 'postgres' and new.digital_products = true and coalesce(old.digital_products, false) = false and not exists (
    select 1 from public.digital_products_release_approvals approval
    where approval.revoked_at is null
      and approval.expires_at > now()
      and approval.provider_accepted_at is not null
      and approval.security_reviewed_at is not null
      and approval.code_reviewed_at is not null
      and approval.ux_reviewed_at is not null
  ) then
    raise exception 'digital_products_release_approval_required';
  end if;
  return new;
end
$$;

drop trigger if exists enforce_digital_products_release_approval on public.store_feature_flags;
create trigger enforce_digital_products_release_approval
before insert or update of digital_products on public.store_feature_flags
for each row execute function public.enforce_digital_products_release_approval();

revoke all on function public.enforce_digital_products_release_approval() from public, anon, authenticated;
