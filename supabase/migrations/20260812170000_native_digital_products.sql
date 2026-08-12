alter table public.products
  add column if not exists product_type text not null default 'physical'
    check (product_type in ('physical', 'digital')),
  add column if not exists digital_rights_affirmed_at timestamptz,
  add column if not exists digital_rights_affirmed_by_user_id uuid references auth.users(id) on delete set null;

alter table public.order_items
  add column if not exists product_type text not null default 'physical'
    check (product_type in ('physical', 'digital'));

alter table public.orders
  add column if not exists digital_consent_version text,
  add column if not exists digital_consent_accepted_at timestamptz,
  add column if not exists digital_license_version text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('digital-product-assets', 'digital-product-assets', false, 262144000, array['image/jpeg', 'image/png', 'application/pdf', 'application/zip'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('digital-product-previews', 'digital-product-previews', true, 10485760, array['image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.digital_product_assets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  product_variant_id uuid references public.product_variants(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 160),
  sort_order integer not null default 0 check (sort_order >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_product_asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.digital_product_assets(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  storage_path text not null unique check (char_length(trim(storage_path)) > 0),
  customer_filename text not null check (char_length(trim(customer_filename)) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'application/pdf', 'application/zip')),
  byte_size bigint not null check (byte_size between 1 and 262144000),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'uploading' check (status in ('uploading', 'processing', 'ready', 'failed')),
  failure_reason text,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  unique (asset_id, version_number)
);

create table if not exists public.digital_product_previews (
  product_id uuid primary key references public.products(id) on delete cascade,
  source_asset_version_id uuid references public.digital_product_asset_versions(id) on delete set null,
  public_preview_path text,
  status text not null default 'missing' check (status in ('missing', 'processing', 'ready', 'failed')),
  is_merchant_override boolean not null default false,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_order_entitlements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_variant_id uuid references public.product_variants(id) on delete restrict,
  asset_id uuid not null references public.digital_product_assets(id) on delete restrict,
  asset_version_id uuid not null references public.digital_product_asset_versions(id) on delete restrict,
  customer_filename text not null,
  mime_type text not null,
  byte_size bigint not null,
  license_version text not null,
  max_download_grants integer not null default 5 check (max_download_grants > 0),
  download_grants_used integer not null default 0 check (download_grants_used >= 0 and download_grants_used <= max_download_grants),
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  status_reason text,
  first_accessed_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_item_id, asset_version_id)
);

create table if not exists public.digital_order_access_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  issuance_reason text not null check (issuance_reason in ('purchase', 'customer_request', 'merchant_resend')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.digital_download_grants (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.digital_order_entitlements(id) on delete restrict,
  access_token_id uuid references public.digital_order_access_tokens(id) on delete set null,
  reservation_key text not null unique,
  status text not null default 'reserved' check (status in ('reserved', 'issued', 'released', 'failed')),
  reserved_at timestamptz not null default now(),
  issued_at timestamptz,
  failure_reason text
);

create index if not exists idx_digital_assets_product on public.digital_product_assets(product_id, active, sort_order);
create index if not exists idx_digital_asset_versions_asset on public.digital_product_asset_versions(asset_id, version_number desc);
create index if not exists idx_digital_entitlements_order on public.digital_order_entitlements(order_id, status);
create index if not exists idx_digital_access_tokens_order on public.digital_order_access_tokens(order_id, expires_at desc);
create index if not exists idx_digital_download_grants_entitlement on public.digital_download_grants(entitlement_id, reserved_at desc);

drop trigger if exists digital_product_assets_set_updated_at on public.digital_product_assets;
create trigger digital_product_assets_set_updated_at before update on public.digital_product_assets
for each row execute function public.set_updated_at();
drop trigger if exists digital_product_previews_set_updated_at on public.digital_product_previews;
create trigger digital_product_previews_set_updated_at before update on public.digital_product_previews
for each row execute function public.set_updated_at();
drop trigger if exists digital_order_entitlements_set_updated_at on public.digital_order_entitlements;
create trigger digital_order_entitlements_set_updated_at before update on public.digital_order_entitlements
for each row execute function public.set_updated_at();

alter table public.digital_product_assets enable row level security;
alter table public.digital_product_asset_versions enable row level security;
alter table public.digital_product_previews enable row level security;
alter table public.digital_order_entitlements enable row level security;
alter table public.digital_order_access_tokens enable row level security;
alter table public.digital_download_grants enable row level security;

create policy digital_assets_store_manage on public.digital_product_assets for all
using (public.can_manage_store_membership_for_store(store_id))
with check (public.can_manage_store_membership_for_store(store_id));

create policy digital_asset_versions_store_manage on public.digital_product_asset_versions for all
using (exists (select 1 from public.digital_product_assets a where a.id = asset_id and public.can_manage_store_membership_for_store(a.store_id)))
with check (exists (select 1 from public.digital_product_assets a where a.id = asset_id and public.can_manage_store_membership_for_store(a.store_id)));

create policy digital_previews_store_manage on public.digital_product_previews for all
using (exists (select 1 from public.products p where p.id = product_id and public.can_manage_store_membership_for_store(p.store_id)))
with check (exists (select 1 from public.products p where p.id = product_id and public.can_manage_store_membership_for_store(p.store_id)));

create policy digital_entitlements_store_read on public.digital_order_entitlements for select
using (public.can_manage_store_membership_for_store(store_id));

-- Access tokens and grant reservations are intentionally service-role only.
