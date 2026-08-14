-- This migration is intentionally forward-only. The prototype migration may have
-- reached a shared environment, so its history must remain immutable.

alter table public.storefront_checkout_sessions
  add column if not exists digital_consent_version text,
  add column if not exists digital_consent_accepted_at timestamptz,
  add column if not exists digital_license_version text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'digital-product-assets',
  'digital-product-assets',
  false,
  262144000,
  array['image/jpeg', 'image/png', 'application/pdf', 'application/zip']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'digital-product-previews',
  'digital-product-previews',
  true,
  10485760,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Composite keys on the commerce graph make tenant and parent identity part of
-- every digital-product relationship.
alter table public.products
  add constraint products_id_store_id_key unique (id, store_id);

alter table public.product_variants
  drop constraint if exists product_variants_product_id_fkey,
  add constraint product_variants_id_product_id_store_id_key
    unique (id, product_id, store_id),
  add constraint product_variants_product_store_fk
    foreign key (product_id, store_id)
    references public.products(id, store_id)
    on delete cascade;

alter table public.orders
  add constraint orders_id_store_id_key unique (id, store_id);

alter table public.order_items
  add column store_id uuid;

update public.order_items oi
set store_id = o.store_id
from public.orders o
where o.id = oi.order_id;

alter table public.order_items
  alter column store_id set not null,
  drop constraint if exists order_items_order_id_fkey,
  drop constraint if exists order_items_product_id_fkey,
  drop constraint if exists order_items_product_variant_id_fkey,
  add constraint order_items_id_order_product_store_key
    unique (id, order_id, product_id, store_id),
  add constraint order_items_order_store_fk
    foreign key (order_id, store_id)
    references public.orders(id, store_id)
    on delete cascade,
  add constraint order_items_product_store_fk
    foreign key (product_id, store_id)
    references public.products(id, store_id)
    on delete restrict,
  add constraint order_items_variant_product_store_fk
    foreign key (product_variant_id, product_id, store_id)
    references public.product_variants(id, product_id, store_id)
    on delete restrict;

create or replace function public.set_order_item_store_id()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_store_id uuid;
begin
  select store_id into v_store_id
  from public.orders
  where id = new.order_id;

  if not found then
    raise exception 'Order not found for order item';
  end if;
  if new.store_id is not null and new.store_id <> v_store_id then
    raise exception 'Order item store does not match its order';
  end if;

  new.store_id = v_store_id;
  return new;
end;
$$;

create trigger order_items_set_store_id
before insert or update of order_id, store_id on public.order_items
for each row execute function public.set_order_item_store_id();

alter table public.storefront_checkout_sessions
  drop constraint if exists storefront_checkout_sessions_order_id_fkey,
  add constraint storefront_checkout_sessions_id_store_id_key
    unique (id, store_id),
  add constraint storefront_checkout_sessions_order_store_fk
    foreign key (order_id, store_id)
    references public.orders(id, store_id)
    on delete set null (order_id);

alter table public.digital_product_assets
  drop constraint if exists digital_product_assets_product_id_fkey,
  drop constraint if exists digital_product_assets_product_variant_id_fkey,
  add constraint digital_product_assets_id_store_id_key
    unique (id, store_id),
  add constraint digital_product_assets_id_product_store_key
    unique (id, product_id, store_id),
  add constraint digital_product_assets_product_store_fk
    foreign key (product_id, store_id)
    references public.products(id, store_id)
    on delete cascade,
  add constraint digital_product_assets_variant_product_store_fk
    foreign key (product_variant_id, product_id, store_id)
    references public.product_variants(id, product_id, store_id)
    on delete cascade,
  add constraint digital_product_assets_timestamps_check
    check (updated_at >= created_at);

alter table public.digital_product_asset_versions
  add column product_id uuid,
  add column store_id uuid,
  add column upload_completed_at timestamptz,
  add column orphan_cleanup_after timestamptz default (now() + interval '24 hours'),
  add column orphaned_at timestamptz;

update public.digital_product_asset_versions v
set product_id = a.product_id,
    store_id = a.store_id,
    upload_completed_at = case
      when v.status = 'uploading' then null
      else coalesce(v.upload_completed_at, v.created_at)
    end,
    orphan_cleanup_after = case
      when v.status = 'uploading' then coalesce(v.orphan_cleanup_after, v.created_at + interval '24 hours')
      else null
    end
from public.digital_product_assets a
where a.id = v.asset_id;

alter table public.digital_product_asset_versions
  alter column product_id set not null,
  alter column store_id set not null,
  drop constraint if exists digital_product_asset_versions_asset_id_fkey,
  add constraint digital_product_asset_versions_id_asset_product_store_key
    unique (id, asset_id, product_id, store_id),
  add constraint digital_product_asset_versions_asset_product_store_fk
    foreign key (asset_id, product_id, store_id)
    references public.digital_product_assets(id, product_id, store_id)
    on delete restrict,
  add constraint digital_product_asset_versions_upload_lifecycle_check
    check (
      (
        status = 'uploading'
        and upload_completed_at is null
        and orphan_cleanup_after is not null
        and orphan_cleanup_after > created_at
      )
      or (
        status <> 'uploading'
        and upload_completed_at is not null
        and upload_completed_at >= created_at
        and orphan_cleanup_after is null
      )
    ),
  add constraint digital_product_asset_versions_retired_at_check
    check (retired_at is null or retired_at >= created_at),
  add constraint digital_product_asset_versions_orphaned_at_check
    check (
      orphaned_at is null
      or (
        status = 'uploading'
        and orphan_cleanup_after is not null
        and orphaned_at >= orphan_cleanup_after
      )
    );

create or replace function public.set_digital_asset_version_upload_lifecycle()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'uploading' then
    new.upload_completed_at = null;
    new.orphan_cleanup_after = coalesce(
      new.orphan_cleanup_after,
      new.created_at + interval '24 hours'
    );
  else
    new.upload_completed_at = coalesce(new.upload_completed_at, now());
    new.orphan_cleanup_after = null;
  end if;
  return new;
end;
$$;

create or replace function public.set_digital_asset_version_relations()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  select product_id, store_id
  into new.product_id, new.store_id
  from public.digital_product_assets
  where id = new.asset_id;

  if not found then
    raise exception 'Digital product asset not found for version';
  end if;

  return new;
end;
$$;

create trigger digital_asset_versions_set_relations
before insert or update of asset_id, product_id, store_id
on public.digital_product_asset_versions
for each row execute function public.set_digital_asset_version_relations();

create trigger digital_asset_versions_set_upload_lifecycle
before insert or update of status, upload_completed_at, orphan_cleanup_after
on public.digital_product_asset_versions
for each row execute function public.set_digital_asset_version_upload_lifecycle();

alter table public.digital_product_previews
  add column store_id uuid,
  add column source_asset_id uuid;

update public.digital_product_previews p
set store_id = product.store_id
from public.products product
where product.id = p.product_id;

update public.digital_product_previews p
set source_asset_id = v.asset_id
from public.digital_product_asset_versions v
where v.id = p.source_asset_version_id;

alter table public.digital_product_previews
  alter column store_id set not null,
  drop constraint if exists digital_product_previews_product_id_fkey,
  drop constraint if exists digital_product_previews_source_asset_version_id_fkey,
  add constraint digital_product_previews_product_store_key
    unique (product_id, store_id),
  add constraint digital_product_previews_product_store_fk
    foreign key (product_id, store_id)
    references public.products(id, store_id)
    on delete cascade,
  add constraint digital_product_previews_source_version_fk
    foreign key (source_asset_version_id, source_asset_id, product_id, store_id)
    references public.digital_product_asset_versions(id, asset_id, product_id, store_id)
    on delete set null (source_asset_version_id, source_asset_id),
  add constraint digital_product_previews_source_pair_check
    check ((source_asset_version_id is null) = (source_asset_id is null)),
  add constraint digital_product_previews_path_status_check
    check (
      (
        status = 'ready'
        and coalesce(char_length(trim(public_preview_path)), 0) > 0
      )
      or status <> 'ready'
    ),
  add constraint digital_product_previews_timestamps_check
    check (updated_at >= created_at);

create or replace function public.set_digital_product_preview_relations()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  select store_id into new.store_id
  from public.products
  where id = new.product_id;

  if not found then
    raise exception 'Product not found for digital preview';
  end if;

  if new.source_asset_version_id is null then
    new.source_asset_id = null;
  else
    select asset_id into new.source_asset_id
    from public.digital_product_asset_versions
    where id = new.source_asset_version_id;

    if not found then
      raise exception 'Digital product asset version not found for preview';
    end if;
  end if;

  return new;
end;
$$;

create trigger digital_product_previews_set_relations
before insert or update of product_id, store_id, source_asset_id, source_asset_version_id
on public.digital_product_previews
for each row execute function public.set_digital_product_preview_relations();

alter table public.digital_order_entitlements
  drop constraint if exists digital_order_entitlements_order_id_fkey,
  drop constraint if exists digital_order_entitlements_order_item_id_fkey,
  drop constraint if exists digital_order_entitlements_product_id_fkey,
  drop constraint if exists digital_order_entitlements_product_variant_id_fkey,
  drop constraint if exists digital_order_entitlements_asset_id_fkey,
  drop constraint if exists digital_order_entitlements_asset_version_id_fkey,
  add constraint digital_order_entitlements_id_order_store_key
    unique (id, order_id, store_id),
  add constraint digital_order_entitlements_order_store_fk
    foreign key (order_id, store_id)
    references public.orders(id, store_id)
    on delete restrict,
  add constraint digital_order_entitlements_order_item_fk
    foreign key (order_item_id, order_id, product_id, store_id)
    references public.order_items(id, order_id, product_id, store_id)
    on delete restrict,
  add constraint digital_order_entitlements_variant_product_store_fk
    foreign key (product_variant_id, product_id, store_id)
    references public.product_variants(id, product_id, store_id)
    on delete restrict,
  add constraint digital_order_entitlements_asset_product_store_fk
    foreign key (asset_id, product_id, store_id)
    references public.digital_product_assets(id, product_id, store_id)
    on delete restrict,
  add constraint digital_order_entitlements_asset_version_fk
    foreign key (asset_version_id, asset_id, product_id, store_id)
    references public.digital_product_asset_versions(id, asset_id, product_id, store_id)
    on delete restrict,
  add constraint digital_order_entitlements_snapshot_check
    check (
      char_length(trim(customer_filename)) between 1 and 255
      and mime_type in ('image/jpeg', 'image/png', 'application/pdf', 'application/zip')
      and byte_size between 1 and 262144000
      and char_length(trim(license_version)) > 0
    ),
  add constraint digital_order_entitlements_access_timestamps_check
    check (
      (first_accessed_at is null or first_accessed_at >= created_at)
      and (last_accessed_at is null or last_accessed_at >= coalesce(first_accessed_at, created_at))
      and updated_at >= created_at
    );

alter table public.digital_order_access_tokens
  add column store_id uuid;

update public.digital_order_access_tokens token
set store_id = o.store_id
from public.orders o
where o.id = token.order_id;

alter table public.digital_order_access_tokens
  alter column store_id set not null,
  drop constraint if exists digital_order_access_tokens_order_id_fkey,
  add constraint digital_order_access_tokens_id_order_store_key
    unique (id, order_id, store_id),
  add constraint digital_order_access_tokens_order_store_fk
    foreign key (order_id, store_id)
    references public.orders(id, store_id)
    on delete cascade,
  add constraint digital_order_access_tokens_expiry_check
    check (expires_at > created_at and (revoked_at is null or revoked_at >= created_at));

create or replace function public.set_digital_order_access_token_store_id()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  select store_id into new.store_id
  from public.orders
  where id = new.order_id;

  if not found then
    raise exception 'Order not found for digital access token';
  end if;

  return new;
end;
$$;

create trigger digital_order_access_tokens_set_store_id
before insert or update of order_id, store_id
on public.digital_order_access_tokens
for each row execute function public.set_digital_order_access_token_store_id();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'digital_download_grants'
      and column_name = 'failure_reason'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'digital_download_grants'
      and column_name = 'last_safe_error'
  ) then
    alter table public.digital_download_grants
      rename column failure_reason to last_safe_error;
  end if;
end;
$$;

alter table public.digital_download_grants
  add column store_id uuid,
  add column order_id uuid,
  add column client_fingerprint_hash text,
  add column reservation_expires_at timestamptz,
  add column grace_expires_at timestamptz,
  add column released_at timestamptz,
  add column failed_at timestamptz;

update public.digital_download_grants grant_row
set store_id = entitlement.store_id,
    order_id = entitlement.order_id,
    client_fingerprint_hash = coalesce(
      grant_row.client_fingerprint_hash,
      encode(sha256(convert_to(grant_row.reservation_key, 'UTF8')), 'hex')
    ),
    reservation_expires_at = coalesce(
      grant_row.reservation_expires_at,
      grant_row.reserved_at + interval '5 minutes'
    ),
    issued_at = case
      when grant_row.status = 'issued' then coalesce(grant_row.issued_at, grant_row.reserved_at)
      else grant_row.issued_at
    end,
    grace_expires_at = case
      when grant_row.status = 'issued' then coalesce(
        grant_row.grace_expires_at,
        coalesce(grant_row.issued_at, grant_row.reserved_at) + interval '60 seconds'
      )
      else grant_row.grace_expires_at
    end,
    released_at = case
      when grant_row.status = 'released' then coalesce(grant_row.released_at, grant_row.reserved_at)
      else grant_row.released_at
    end,
    failed_at = case
      when grant_row.status = 'failed' then coalesce(grant_row.failed_at, grant_row.reserved_at)
      else grant_row.failed_at
    end,
    last_safe_error = case
      when grant_row.status = 'failed' then coalesce(nullif(trim(grant_row.last_safe_error), ''), 'Legacy grant failed')
      else grant_row.last_safe_error
    end
from public.digital_order_entitlements entitlement
where entitlement.id = grant_row.entitlement_id;

alter table public.digital_download_grants
  alter column store_id set not null,
  alter column order_id set not null,
  alter column client_fingerprint_hash set not null,
  alter column reservation_expires_at set not null,
  drop constraint if exists digital_download_grants_entitlement_id_fkey,
  drop constraint if exists digital_download_grants_access_token_id_fkey,
  add constraint digital_download_grants_fingerprint_check
    check (client_fingerprint_hash ~ '^[a-f0-9]{64}$'),
  add constraint digital_download_grants_reservation_expiry_check
    check (reservation_expires_at > reserved_at),
  add constraint digital_download_grants_entitlement_order_store_fk
    foreign key (entitlement_id, order_id, store_id)
    references public.digital_order_entitlements(id, order_id, store_id)
    on delete restrict,
  add constraint digital_download_grants_access_token_order_store_fk
    foreign key (access_token_id, order_id, store_id)
    references public.digital_order_access_tokens(id, order_id, store_id)
    on delete set null (access_token_id),
  add constraint digital_download_grants_lifecycle_check
    check (
      (
        status = 'reserved'
        and issued_at is null
        and released_at is null
        and failed_at is null
        and grace_expires_at is null
      )
      or (
        status = 'issued'
        and issued_at is not null
        and grace_expires_at >= issued_at
        and released_at is null
        and failed_at is null
      )
      or (
        status = 'released'
        and issued_at is null
        and released_at >= reserved_at
        and failed_at is null
        and grace_expires_at is null
      )
      or (
        status = 'failed'
        and issued_at is null
        and released_at is null
        and failed_at >= reserved_at
        and grace_expires_at is null
        and coalesce(char_length(trim(last_safe_error)), 0) between 1 and 500
      )
    );

-- The manifest is captured before checkout-session creation, associated with the
-- order during finalization, and becomes append/update/delete immutable at lock.
create table public.digital_purchase_manifests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  checkout_session_id uuid,
  order_id uuid,
  consent_version text not null check (char_length(trim(consent_version)) > 0),
  license_version text not null check (char_length(trim(license_version)) > 0),
  status text not null default 'draft' check (status in ('draft', 'locked')),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_purchase_manifests_id_store_key unique (id, store_id),
  constraint digital_purchase_manifests_id_order_store_key unique (id, order_id, store_id),
  constraint digital_purchase_manifests_checkout_store_fk
    foreign key (checkout_session_id, store_id)
    references public.storefront_checkout_sessions(id, store_id)
    on delete restrict,
  constraint digital_purchase_manifests_order_store_fk
    foreign key (order_id, store_id)
    references public.orders(id, store_id)
    on delete restrict,
  constraint digital_purchase_manifests_lock_check
    check (
      (status = 'draft' and locked_at is null)
      or (
        status = 'locked'
        and order_id is not null
        and locked_at is not null
        and locked_at >= created_at
      )
    )
);

create unique index digital_purchase_manifests_checkout_session_unique
  on public.digital_purchase_manifests(checkout_session_id)
  where checkout_session_id is not null;

create unique index digital_purchase_manifests_order_unique
  on public.digital_purchase_manifests(order_id)
  where order_id is not null;

create table public.digital_purchase_manifest_items (
  id uuid primary key default gen_random_uuid(),
  manifest_id uuid not null,
  store_id uuid not null,
  order_id uuid,
  order_item_id uuid,
  product_id uuid not null,
  product_variant_id uuid,
  asset_id uuid not null,
  asset_version_id uuid not null,
  customer_filename text not null check (char_length(trim(customer_filename)) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'application/pdf', 'application/zip')),
  byte_size bigint not null check (byte_size between 1 and 262144000),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  label text not null check (char_length(trim(label)) between 1 and 160),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_purchase_manifest_items_manifest_version_key
    unique (manifest_id, asset_version_id),
  constraint digital_purchase_manifest_items_manifest_store_fk
    foreign key (manifest_id, store_id)
    references public.digital_purchase_manifests(id, store_id)
    on delete cascade,
  constraint digital_purchase_manifest_items_manifest_order_fk
    foreign key (manifest_id, order_id, store_id)
    references public.digital_purchase_manifests(id, order_id, store_id)
    on delete cascade,
  constraint digital_purchase_manifest_items_order_item_fk
    foreign key (order_item_id, order_id, product_id, store_id)
    references public.order_items(id, order_id, product_id, store_id)
    on delete restrict,
  constraint digital_purchase_manifest_items_variant_product_store_fk
    foreign key (product_variant_id, product_id, store_id)
    references public.product_variants(id, product_id, store_id)
    on delete restrict,
  constraint digital_purchase_manifest_items_asset_product_store_fk
    foreign key (asset_id, product_id, store_id)
    references public.digital_product_assets(id, product_id, store_id)
    on delete restrict,
  constraint digital_purchase_manifest_items_asset_version_fk
    foreign key (asset_version_id, asset_id, product_id, store_id)
    references public.digital_product_asset_versions(id, asset_id, product_id, store_id)
    on delete restrict,
  constraint digital_purchase_manifest_items_order_pair_check
    check ((order_id is null) = (order_item_id is null)),
  constraint digital_purchase_manifest_items_timestamps_check
    check (updated_at >= created_at)
);

create table public.digital_manifest_repair_audit (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('manifest', 'manifest_item')),
  subject_id uuid not null,
  operation text not null check (operation in ('update', 'delete')),
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  old_record jsonb not null,
  new_record jsonb,
  repaired_at timestamptz not null default now()
);

create or replace function public.enforce_locked_digital_manifest_immutability()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_repair_allowed boolean :=
    current_user = 'postgres'
    and current_setting('myrivo.digital_manifest_repair', true) = 'on';
begin
  if v_repair_allowed then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_table_name = 'digital_purchase_manifests' then
    if old.status = 'locked' then
      raise exception 'Locked digital purchase manifests are immutable';
    end if;
    if tg_op = 'UPDATE'
       and old.status = 'draft'
       and new.status = 'locked'
       and (
         not exists (
           select 1
           from public.digital_purchase_manifest_items item
           where item.manifest_id = old.id
         )
         or exists (
           select 1
           from public.digital_purchase_manifest_items item
           where item.manifest_id = old.id
             and (
               item.store_id <> new.store_id
               or item.order_id is distinct from new.order_id
               or item.order_item_id is null
             )
         )
       ) then
      raise exception 'A locked digital purchase manifest requires order-associated items';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    select status into v_status
    from public.digital_purchase_manifests
    where id = old.manifest_id;
    if v_status = 'locked' then
      raise exception 'Locked digital purchase manifest items are immutable';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select status into v_status
    from public.digital_purchase_manifests
    where id = new.manifest_id;
    if v_status = 'locked' then
      raise exception 'Locked digital purchase manifest items are immutable';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger digital_purchase_manifests_immutable_when_locked
before update or delete on public.digital_purchase_manifests
for each row execute function public.enforce_locked_digital_manifest_immutability();

create trigger digital_purchase_manifest_items_immutable_when_locked
before insert or update or delete on public.digital_purchase_manifest_items
for each row execute function public.enforce_locked_digital_manifest_immutability();

create trigger digital_purchase_manifests_set_updated_at
before update on public.digital_purchase_manifests
for each row execute function public.set_updated_at();

create trigger digital_purchase_manifest_items_set_updated_at
before update on public.digital_purchase_manifest_items
for each row execute function public.set_updated_at();

create or replace function public.admin_repair_digital_purchase_manifest_item(
  p_manifest_item_id uuid,
  p_customer_filename text,
  p_mime_type text,
  p_byte_size bigint,
  p_checksum_sha256 text,
  p_label text,
  p_sort_order integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.digital_purchase_manifest_items%rowtype;
  v_new public.digital_purchase_manifest_items%rowtype;
begin
  if char_length(trim(p_reason)) not between 1 and 500 then
    raise exception 'A safe administrative repair reason is required';
  end if;

  select * into v_old
  from public.digital_purchase_manifest_items
  where id = p_manifest_item_id
  for update;

  if not found then
    raise exception 'Digital purchase manifest item not found';
  end if;

  perform set_config('myrivo.digital_manifest_repair', 'on', true);

  update public.digital_purchase_manifest_items
  set customer_filename = p_customer_filename,
      mime_type = p_mime_type,
      byte_size = p_byte_size,
      checksum_sha256 = p_checksum_sha256,
      label = p_label,
      sort_order = p_sort_order
  where id = p_manifest_item_id
  returning * into v_new;

  insert into public.digital_manifest_repair_audit(
    subject_type,
    subject_id,
    operation,
    reason,
    old_record,
    new_record
  ) values (
    'manifest_item',
    p_manifest_item_id,
    'update',
    trim(p_reason),
    to_jsonb(v_old),
    to_jsonb(v_new)
  );
end;
$$;

revoke all on function public.admin_repair_digital_purchase_manifest_item(
  uuid, text, text, bigint, text, text, integer, text
) from public, anon, authenticated;
grant execute on function public.admin_repair_digital_purchase_manifest_item(
  uuid, text, text, bigint, text, text, integer, text
) to service_role;

-- Jobs contain only identifiers and bounded safe errors. Attempts never persist
-- access tokens, private object paths, or signed URLs.
create table public.digital_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  order_id uuid not null,
  job_type text not null check (char_length(trim(job_type)) between 1 and 80),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_safe_error text check (last_safe_error is null or char_length(trim(last_safe_error)) between 1 and 500),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_delivery_jobs_order_type_key unique (order_id, job_type),
  constraint digital_delivery_jobs_id_order_store_key unique (id, order_id, store_id),
  constraint digital_delivery_jobs_order_store_fk
    foreign key (order_id, store_id)
    references public.orders(id, store_id)
    on delete restrict,
  constraint digital_delivery_jobs_lifecycle_check
    check (
      (status = 'processing' and lease_expires_at is not null and completed_at is null)
      or (status = 'pending' and lease_expires_at is null and completed_at is null)
      or (status in ('succeeded', 'failed') and lease_expires_at is null and completed_at is not null)
    ),
  constraint digital_delivery_jobs_timestamps_check
    check (
      updated_at >= created_at
      and next_attempt_at >= created_at
      and (lease_expires_at is null or lease_expires_at > updated_at)
      and (completed_at is null or completed_at >= created_at)
    )
);

create table public.digital_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  order_id uuid not null,
  store_id uuid not null,
  attempt_number integer not null check (attempt_number > 0),
  status text not null check (status in ('processing', 'succeeded', 'failed')),
  safe_error text check (safe_error is null or char_length(trim(safe_error)) between 1 and 500),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint digital_delivery_attempts_job_number_key unique (job_id, attempt_number),
  constraint digital_delivery_attempts_job_order_store_fk
    foreign key (job_id, order_id, store_id)
    references public.digital_delivery_jobs(id, order_id, store_id)
    on delete cascade,
  constraint digital_delivery_attempts_lifecycle_check
    check (
      (status = 'processing' and finished_at is null and safe_error is null)
      or (status = 'succeeded' and finished_at is not null and safe_error is null)
      or (status = 'failed' and finished_at is not null and safe_error is not null)
    ),
  constraint digital_delivery_attempts_timestamps_check
    check (finished_at is null or finished_at >= started_at)
);

create index digital_delivery_jobs_claim_idx
  on public.digital_delivery_jobs(status, next_attempt_at)
  where status in ('pending', 'failed');

create index digital_delivery_attempts_job_idx
  on public.digital_delivery_attempts(job_id, attempt_number desc);

drop function if exists public.reserve_digital_download_grant(uuid, uuid, text);

create or replace function public.reserve_digital_download_grant(
  p_entitlement_id uuid,
  p_access_token_id uuid,
  p_reservation_key text,
  p_client_fingerprint_hash text
)
returns table(
  grant_id uuid,
  asset_version_id uuid,
  customer_filename text,
  grant_status text,
  reservation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entitlement public.digital_order_entitlements%rowtype;
  v_existing public.digital_download_grants%rowtype;
  v_grant public.digital_download_grants%rowtype;
  v_active_reservations integer;
begin
  if char_length(trim(p_reservation_key)) not between 1 and 160 then
    raise exception 'Invalid download reservation';
  end if;
  if p_client_fingerprint_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid download client fingerprint';
  end if;

  select * into v_entitlement
  from public.digital_order_entitlements
  where id = p_entitlement_id
  for update;

  if not found or v_entitlement.status <> 'active' then
    raise exception 'Download unavailable';
  end if;

  if not exists (
    select 1
    from public.digital_order_access_tokens token
    where token.id = p_access_token_id
      and token.order_id = v_entitlement.order_id
      and token.store_id = v_entitlement.store_id
      and token.revoked_at is null
      and token.expires_at > now()
  ) then
    raise exception 'Download unavailable';
  end if;

  select * into v_existing
  from public.digital_download_grants grant_row
  where grant_row.reservation_key = p_reservation_key;

  if found then
    if v_existing.entitlement_id <> p_entitlement_id
       or v_existing.access_token_id is distinct from p_access_token_id
       or v_existing.client_fingerprint_hash <> p_client_fingerprint_hash then
      raise exception 'Download reservation conflict';
    end if;

    return query select
      v_existing.id,
      v_entitlement.asset_version_id,
      v_entitlement.customer_filename,
      v_existing.status,
      v_existing.reservation_expires_at;
    return;
  end if;

  select count(*) into v_active_reservations
  from public.digital_download_grants grant_row
  where grant_row.entitlement_id = p_entitlement_id
    and grant_row.status = 'reserved'
    and grant_row.reservation_expires_at > now();

  if v_entitlement.download_grants_used + v_active_reservations >= v_entitlement.max_download_grants then
    raise exception 'Download limit reached';
  end if;

  insert into public.digital_download_grants(
    store_id,
    order_id,
    entitlement_id,
    access_token_id,
    reservation_key,
    client_fingerprint_hash,
    status,
    reservation_expires_at
  ) values (
    v_entitlement.store_id,
    v_entitlement.order_id,
    p_entitlement_id,
    p_access_token_id,
    p_reservation_key,
    p_client_fingerprint_hash,
    'reserved',
    now() + interval '5 minutes'
  )
  returning * into v_grant;

  return query select
    v_grant.id,
    v_entitlement.asset_version_id,
    v_entitlement.customer_filename,
    v_grant.status,
    v_grant.reservation_expires_at;
end;
$$;

create or replace function public.commit_digital_download_grant(
  p_grant_id uuid,
  p_client_fingerprint_hash text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_grant public.digital_download_grants%rowtype;
begin
  select * into v_grant
  from public.digital_download_grants
  where id = p_grant_id
  for update;

  if not found or v_grant.client_fingerprint_hash <> p_client_fingerprint_hash then
    raise exception 'Download reservation unavailable';
  end if;

  if v_grant.status = 'issued' then
    return 'issued';
  end if;
  if v_grant.status <> 'reserved' or v_grant.reservation_expires_at <= now() then
    raise exception 'Download reservation unavailable';
  end if;

  update public.digital_order_entitlements
  set download_grants_used = download_grants_used + 1,
      first_accessed_at = coalesce(first_accessed_at, now()),
      last_accessed_at = now()
  where id = v_grant.entitlement_id
    and status = 'active'
    and download_grants_used < max_download_grants;

  if not found then
    raise exception 'Download unavailable';
  end if;

  update public.digital_download_grants
  set status = 'issued',
      issued_at = now(),
      grace_expires_at = now() + interval '60 seconds'
  where id = p_grant_id;

  return 'issued';
end;
$$;

create or replace function public.release_digital_download_grant(
  p_grant_id uuid,
  p_client_fingerprint_hash text,
  p_safe_error text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_grant public.digital_download_grants%rowtype;
begin
  if p_safe_error is not null and char_length(trim(p_safe_error)) not between 1 and 500 then
    raise exception 'Invalid safe release error';
  end if;

  select * into v_grant
  from public.digital_download_grants
  where id = p_grant_id
  for update;

  if not found or v_grant.client_fingerprint_hash <> p_client_fingerprint_hash then
    raise exception 'Download reservation unavailable';
  end if;

  if v_grant.status = 'released' then
    return 'released';
  end if;
  if v_grant.status <> 'reserved' then
    raise exception 'Download reservation unavailable';
  end if;

  update public.digital_download_grants
  set status = 'released',
      released_at = now(),
      last_safe_error = nullif(trim(p_safe_error), '')
  where id = p_grant_id;

  return 'released';
end;
$$;

revoke all on function public.reserve_digital_download_grant(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.commit_digital_download_grant(uuid, text)
  from public, anon, authenticated;
revoke all on function public.release_digital_download_grant(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_digital_download_grant(uuid, uuid, text, text)
  to service_role;
grant execute on function public.commit_digital_download_grant(uuid, text)
  to service_role;
grant execute on function public.release_digital_download_grant(uuid, text, text)
  to service_role;

alter table public.digital_purchase_manifests enable row level security;
alter table public.digital_purchase_manifest_items enable row level security;
alter table public.digital_manifest_repair_audit enable row level security;
alter table public.digital_delivery_jobs enable row level security;
alter table public.digital_delivery_attempts enable row level security;

create policy digital_purchase_manifests_store_read
on public.digital_purchase_manifests for select
using (public.can_manage_store_membership_for_store(store_id));

create policy digital_purchase_manifest_items_store_read
on public.digital_purchase_manifest_items for select
using (public.can_manage_store_membership_for_store(store_id));

create policy digital_delivery_jobs_store_read
on public.digital_delivery_jobs for select
using (public.can_manage_store_membership_for_store(store_id));

create policy digital_delivery_attempts_store_read
on public.digital_delivery_attempts for select
using (public.can_manage_store_membership_for_store(store_id));

drop policy if exists digital_originals_never_public_read on storage.objects;
create policy digital_originals_never_public_read
on storage.objects
as restrictive
for select
to anon, authenticated
using (bucket_id <> 'digital-product-assets');

drop policy if exists digital_previews_public_read on storage.objects;
create policy digital_previews_public_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'digital-product-previews');
