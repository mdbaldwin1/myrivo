-- Transactional upload intents ensure direct-to-storage uploads cannot choose
-- tenant identity, object paths, asset ids, or version ids at completion time.

create or replace function public.digital_asset_max_active_files()
returns integer language sql immutable parallel safe
set search_path = public, pg_temp as $$ select 20 $$;

create or replace function public.digital_asset_max_file_bytes()
returns bigint language sql immutable parallel safe
set search_path = public, pg_temp as $$ select 262144000::bigint $$;

create or replace function public.digital_asset_max_intent_ttl()
returns interval language sql immutable parallel safe
set search_path = public, pg_temp as $$ select interval '2 hours' $$;

create table public.digital_asset_upload_intents (
  id uuid primary key,
  store_id uuid not null,
  product_id uuid not null,
  product_variant_id uuid,
  asset_id uuid not null,
  asset_version_id uuid not null unique,
  existing_asset_id uuid,
  operation text not null check (operation in ('create', 'replace')),
  version_number integer not null check (version_number > 0),
  label text not null check (char_length(trim(label)) between 1 and 160),
  expected_filename text not null check (char_length(trim(expected_filename)) between 1 and 255),
  expected_mime_type text not null check (
    expected_mime_type in ('image/jpeg', 'image/png', 'application/pdf', 'application/zip')
  ),
  expected_byte_size bigint not null check (
    expected_byte_size between 1 and public.digital_asset_max_file_bytes()
  ),
  storage_path text not null unique check (char_length(trim(storage_path)) between 1 and 1024),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'expired')),
  expires_at timestamptz not null,
  completed_version_id uuid,
  completed_at timestamptz,
  last_safe_error text check (coalesce(char_length(last_safe_error), 0) <= 240),
  cleanup_after timestamptz,
  orphaned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_asset_upload_intents_product_store_fk
    foreign key (product_id, store_id)
    references public.products(id, store_id)
    on delete cascade,
  constraint digital_asset_upload_intents_variant_product_store_fk
    foreign key (product_variant_id, product_id, store_id)
    references public.product_variants(id, product_id, store_id)
    on delete cascade,
  constraint digital_asset_upload_intents_existing_asset_fk
    foreign key (existing_asset_id, product_id, store_id)
    references public.digital_product_assets(id, product_id, store_id)
    on delete restrict,
  constraint digital_asset_upload_intents_completed_version_fk
    foreign key (completed_version_id, asset_id, product_id, store_id)
    references public.digital_product_asset_versions(id, asset_id, product_id, store_id)
    on delete restrict,
  constraint digital_asset_upload_intents_operation_fields_check check (
    (operation = 'create' and existing_asset_id is null and version_number = 1)
    or
    (operation = 'replace' and existing_asset_id = asset_id and version_number > 1)
  ),
  constraint digital_asset_upload_intents_status_fields_check check (
    (
      status = 'pending'
      and completed_version_id is null
      and completed_at is null
      and last_safe_error is null
      and cleanup_after is null
      and orphaned_at is null
    )
    or (
      status = 'completed'
      and completed_version_id = asset_version_id
      and completed_at is not null
      and cleanup_after is null
      and orphaned_at is null
    )
    or (
      status in ('failed', 'expired')
      and completed_version_id is null
      and completed_at is null
      and coalesce(char_length(trim(last_safe_error)), 0) > 0
      and cleanup_after is not null
      and orphaned_at is null
    )
    or (
      status in ('failed', 'expired')
      and completed_version_id is null
      and completed_at is null
      and coalesce(char_length(trim(last_safe_error)), 0) > 0
      and cleanup_after is not null
      and orphaned_at >= cleanup_after
    )
  ),
  constraint digital_asset_upload_intents_expiry_check check (expires_at > created_at),
  constraint digital_asset_upload_intents_updated_check check (updated_at >= created_at)
);

alter table public.digital_product_asset_versions
  add constraint digital_product_asset_versions_storage_path_namespace_check
  check (
    storage_path like store_id::text || '/' || product_id::text || '/' || asset_id::text || '/v' || version_number::text || '/%'
    or storage_path like 'private/%'
  ) not valid;

alter table public.digital_product_asset_versions
  validate constraint digital_product_asset_versions_storage_path_namespace_check;

create unique index digital_asset_upload_intents_asset_version_key
  on public.digital_asset_upload_intents(asset_id, version_number);
create index digital_asset_upload_intents_active_product_idx
  on public.digital_asset_upload_intents(product_id, store_id, expires_at)
  where status = 'pending' and operation = 'create';
create index digital_asset_upload_intents_cleanup_idx
  on public.digital_asset_upload_intents(cleanup_after)
  where status in ('failed', 'expired') and orphaned_at is null;

alter table public.digital_asset_upload_intents enable row level security;
-- The table intentionally has no anon/authenticated policy. All access is
-- mediated by the service-role-only functions below.

create trigger digital_asset_upload_intents_set_updated_at
before update on public.digital_asset_upload_intents
for each row execute function public.set_updated_at();

create or replace function public.digital_asset_safe_basename(p_filename text)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        lower(regexp_replace(p_filename, '\.[^.]+$', '')),
        '[^a-z0-9]+', '-', 'g'
      )),
      ''
    ),
    'download'
  )
$$;

create or replace function public.digital_asset_extension_for_mime(p_mime_type text, p_filename text)
returns text
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
declare
  v_extension text := lower(substring(p_filename from '(\.[^.]+)$'));
begin
  if (p_mime_type = 'image/jpeg' and v_extension in ('.jpg', '.jpeg'))
    or (p_mime_type = 'image/png' and v_extension = '.png')
    or (p_mime_type = 'application/pdf' and v_extension = '.pdf')
    or (p_mime_type = 'application/zip' and v_extension = '.zip') then
    return v_extension;
  end if;
  raise exception 'Unsupported digital asset type';
end;
$$;

create or replace function public.create_digital_asset_upload_intent(
  p_intent_id uuid,
  p_store_id uuid,
  p_product_id uuid,
  p_product_variant_id uuid,
  p_asset_id uuid,
  p_asset_version_id uuid,
  p_existing_asset_id uuid,
  p_label text,
  p_expected_filename text,
  p_expected_mime_type text,
  p_expected_byte_size bigint,
  p_storage_path text,
  p_operation text,
  p_expires_at timestamptz
)
returns table(
  intent_id uuid,
  asset_id uuid,
  asset_version_id uuid,
  product_id uuid,
  product_variant_id uuid,
  storage_path text,
  expected_filename text,
  expected_mime_type text,
  expected_byte_size bigint,
  version_number integer,
  operation text,
  intent_status text,
  expires_at timestamptz,
  completed_version_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product_id uuid;
  v_product_variant_id uuid;
  v_label text;
  v_version_number integer;
  v_extension text;
  v_storage_path text;
  v_active_count integer;
begin
  if p_operation not in ('create', 'replace') then
    raise exception 'Invalid digital asset upload operation';
  end if;
  if p_expected_byte_size < 1
    or p_expected_byte_size > public.digital_asset_max_file_bytes() then
    raise exception 'Invalid digital asset upload size';
  end if;
  if p_expires_at <= now()
    or p_expires_at > now() + public.digital_asset_max_intent_ttl() then
    raise exception 'Invalid digital asset upload expiry';
  end if;
  v_extension := public.digital_asset_extension_for_mime(
    p_expected_mime_type,
    p_expected_filename
  );

  if p_operation = 'create' then
    select p.id into v_product_id
    from public.products p
    where p.id = p_product_id
      and p.store_id = p_store_id
      and p.product_type = 'digital'
    for update;
    if not found then raise exception 'Digital product unavailable'; end if;

    if p_product_variant_id is not null and not exists (
      select 1 from public.product_variants v
      where v.id = p_product_variant_id
        and v.product_id = p_product_id
        and v.store_id = p_store_id
    ) then
      raise exception 'Digital product variant unavailable';
    end if;

    select
      (select count(*) from public.digital_product_assets a
       where a.product_id = p_product_id and a.store_id = p_store_id and a.active)
      +
      (select count(*) from public.digital_asset_upload_intents i
       where i.product_id = p_product_id and i.store_id = p_store_id
         and i.operation = 'create' and i.status = 'pending' and i.expires_at > now())
    into v_active_count;
    if v_active_count >= public.digital_asset_max_active_files() then
      raise exception 'Digital asset active file limit reached';
    end if;

    v_product_variant_id := p_product_variant_id;
    v_label := trim(p_label);
    v_version_number := 1;
    if char_length(v_label) not between 1 and 160 then
      raise exception 'Invalid digital asset label';
    end if;
    v_storage_path := p_store_id::text || '/' || p_product_id::text || '/' ||
      p_asset_id::text || '/v1/' || public.digital_asset_safe_basename(p_expected_filename) ||
      v_extension;
    if p_existing_asset_id is not null or p_storage_path is distinct from v_storage_path then
      raise exception 'Invalid digital asset storage path';
    end if;
  else
    select a.product_id into v_product_id
    from public.digital_product_assets a
    where a.id = p_existing_asset_id and a.store_id = p_store_id and a.active;
    if not found or p_asset_id is distinct from p_existing_asset_id then
      raise exception 'Digital asset unavailable';
    end if;
    perform 1 from public.products p
    where p.id = v_product_id and p.store_id = p_store_id and p.product_type = 'digital'
    for update;
    if not found then raise exception 'Digital product unavailable'; end if;
    select a.product_variant_id, a.label
    into v_product_variant_id, v_label
    from public.digital_product_assets a
    where a.id = p_existing_asset_id and a.store_id = p_store_id and a.active
    for update;
    select greatest(
      coalesce((select max(v.version_number) from public.digital_product_asset_versions v
        where v.asset_id = p_asset_id), 0),
      coalesce((select max(i.version_number) from public.digital_asset_upload_intents i
        where i.asset_id = p_asset_id), 0)
    ) + 1 into v_version_number;
    v_storage_path := p_store_id::text || '/' || v_product_id::text || '/' ||
      p_asset_id::text || '/v' || v_version_number::text || '/' ||
      public.digital_asset_safe_basename(p_expected_filename) || v_extension;
  end if;

  insert into public.digital_asset_upload_intents(
    id, store_id, product_id, product_variant_id, asset_id, asset_version_id,
    existing_asset_id, operation, version_number, label, expected_filename,
    expected_mime_type, expected_byte_size, storage_path, expires_at
  ) values (
    p_intent_id, p_store_id, v_product_id, v_product_variant_id, p_asset_id,
    p_asset_version_id, p_existing_asset_id, p_operation, v_version_number,
    v_label, trim(p_expected_filename), p_expected_mime_type,
    p_expected_byte_size, v_storage_path, p_expires_at
  );

  return query
  select i.id, i.asset_id, i.asset_version_id, i.product_id,
    i.product_variant_id, i.storage_path, i.expected_filename,
    i.expected_mime_type, i.expected_byte_size, i.version_number, i.operation,
    i.status, i.expires_at, i.completed_version_id
  from public.digital_asset_upload_intents i
  where i.id = p_intent_id;
end;
$$;

create or replace function public.get_digital_asset_upload_intent(
  p_intent_id uuid,
  p_store_id uuid
)
returns table(
  intent_id uuid,
  asset_id uuid,
  asset_version_id uuid,
  product_id uuid,
  product_variant_id uuid,
  storage_path text,
  expected_filename text,
  expected_mime_type text,
  expected_byte_size bigint,
  version_number integer,
  operation text,
  intent_status text,
  expires_at timestamptz,
  completed_version_id uuid
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select i.id, i.asset_id, i.asset_version_id, i.product_id,
    i.product_variant_id, i.storage_path, i.expected_filename,
    i.expected_mime_type, i.expected_byte_size, i.version_number, i.operation,
    i.status, i.expires_at, i.completed_version_id
  from public.digital_asset_upload_intents i
  where i.id = p_intent_id and i.store_id = p_store_id
$$;

create or replace function public.fail_digital_asset_upload_intent(
  p_store_id uuid,
  p_intent_id uuid,
  p_safe_error text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(char_length(trim(p_safe_error)), 0) not between 1 and 240 then
    raise exception 'Invalid safe upload error';
  end if;
  update public.digital_asset_upload_intents
  set status = 'failed', last_safe_error = trim(p_safe_error),
      cleanup_after = now()
  where id = p_intent_id and store_id = p_store_id
    and status in ('pending', 'failed');
  return found;
end;
$$;

create or replace function public.retry_digital_asset_upload_intent(
  p_store_id uuid,
  p_intent_id uuid,
  p_expires_at timestamptz
)
returns table(
  intent_id uuid,
  asset_id uuid,
  asset_version_id uuid,
  product_id uuid,
  product_variant_id uuid,
  storage_path text,
  expected_filename text,
  expected_mime_type text,
  expected_byte_size bigint,
  version_number integer,
  operation text,
  intent_status text,
  expires_at timestamptz,
  completed_version_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_expires_at <= now()
    or p_expires_at > now() + public.digital_asset_max_intent_ttl() then
    raise exception 'Invalid digital asset upload expiry';
  end if;
  update public.digital_asset_upload_intents i
  set status = 'pending', expires_at = p_expires_at, last_safe_error = null,
      cleanup_after = null, orphaned_at = null
  where i.id = p_intent_id and i.store_id = p_store_id and i.status = 'failed';
  if not found then raise exception 'Digital asset upload unavailable'; end if;
  return query
  select i.id, i.asset_id, i.asset_version_id, i.product_id,
    i.product_variant_id, i.storage_path, i.expected_filename,
    i.expected_mime_type, i.expected_byte_size, i.version_number, i.operation,
    i.status, i.expires_at, i.completed_version_id
  from public.digital_asset_upload_intents i
  where i.id = p_intent_id and i.store_id = p_store_id;
end;
$$;

create or replace function public.finalize_digital_asset_upload_intent(
  p_intent_id uuid,
  p_store_id uuid,
  p_actual_byte_size bigint,
  p_detected_mime_type text,
  p_checksum_sha256 text
)
returns table(
  asset_id uuid,
  asset_version_id uuid,
  product_id uuid,
  mime_type text,
  version_number integer,
  was_already_completed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intent public.digital_asset_upload_intents%rowtype;
  v_sort_order integer;
begin
  select * into v_intent
  from public.digital_asset_upload_intents i
  where i.id = p_intent_id and i.store_id = p_store_id
  for update;
  if not found then raise exception 'Digital asset upload unavailable'; end if;

  if v_intent.status = 'completed' then
    return query select v_intent.asset_id, v_intent.asset_version_id,
      v_intent.product_id, v_intent.expected_mime_type,
      v_intent.version_number, true;
    return;
  end if;
  if v_intent.status <> 'pending' then raise exception 'Digital asset upload unavailable'; end if;
  if v_intent.expires_at <= now() then
    update public.digital_asset_upload_intents
    set status = 'expired', last_safe_error = 'Upload intent expired',
        cleanup_after = now()
    where id = v_intent.id;
    raise exception 'Digital asset upload expired';
  end if;
  if p_actual_byte_size is distinct from v_intent.expected_byte_size
    or p_detected_mime_type is distinct from v_intent.expected_mime_type
    or p_checksum_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'Digital asset verification mismatch';
  end if;

  perform 1 from public.products p
  where p.id = v_intent.product_id and p.store_id = v_intent.store_id
  for update;
  if not found then raise exception 'Digital product unavailable'; end if;

  if v_intent.operation = 'create' then
    select coalesce(max(a.sort_order), -1) + 1 into v_sort_order
    from public.digital_product_assets a
    where a.product_id = v_intent.product_id and a.store_id = v_intent.store_id and a.active;
    insert into public.digital_product_assets(
      id, store_id, product_id, product_variant_id, label, sort_order, active
    ) values (
      v_intent.asset_id, v_intent.store_id, v_intent.product_id,
      v_intent.product_variant_id, v_intent.label, v_sort_order, true
    );
  else
    perform 1 from public.digital_product_assets a
    where a.id = v_intent.asset_id and a.store_id = v_intent.store_id
      and a.product_id = v_intent.product_id and a.active
    for update;
    if not found then raise exception 'Digital asset unavailable'; end if;
    update public.digital_product_asset_versions
    set retired_at = coalesce(retired_at, now())
    where digital_product_asset_versions.asset_id = v_intent.asset_id
      and retired_at is null;
  end if;

  insert into public.digital_product_asset_versions(
    id, asset_id, product_id, store_id, version_number, storage_path,
    customer_filename, mime_type, byte_size, checksum_sha256, status,
    upload_completed_at, orphan_cleanup_after
  ) values (
    v_intent.asset_version_id, v_intent.asset_id, v_intent.product_id,
    v_intent.store_id, v_intent.version_number, v_intent.storage_path,
    v_intent.expected_filename, v_intent.expected_mime_type,
    p_actual_byte_size, p_checksum_sha256, 'ready', now(), null
  );

  update public.digital_asset_upload_intents
  set status = 'completed', completed_version_id = v_intent.asset_version_id,
      completed_at = now(), cleanup_after = null, last_safe_error = null
  where id = v_intent.id;

  return query select v_intent.asset_id, v_intent.asset_version_id,
    v_intent.product_id, v_intent.expected_mime_type,
    v_intent.version_number, false;
end;
$$;

create or replace function public.update_digital_product_asset(
  p_store_id uuid,
  p_asset_id uuid,
  p_label text,
  p_set_label boolean,
  p_product_variant_id uuid,
  p_set_product_variant_id boolean
)
returns setof public.digital_product_assets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_asset public.digital_product_assets%rowtype;
begin
  select * into v_asset from public.digital_product_assets a
  where a.id = p_asset_id and a.store_id = p_store_id and a.active
  for update;
  if not found then raise exception 'Digital asset unavailable'; end if;
  if p_set_label and coalesce(char_length(trim(p_label)), 0) not between 1 and 160 then
    raise exception 'Invalid digital asset label';
  end if;
  if p_set_product_variant_id and p_product_variant_id is not null and not exists (
    select 1 from public.product_variants v
    where v.id = p_product_variant_id and v.product_id = v_asset.product_id
      and v.store_id = p_store_id
  ) then
    raise exception 'Digital product variant unavailable';
  end if;
  return query
  update public.digital_product_assets a
  set label = case when p_set_label then trim(p_label) else a.label end,
      product_variant_id = case when p_set_product_variant_id then p_product_variant_id else a.product_variant_id end
  where a.id = p_asset_id and a.store_id = p_store_id
  returning a.*;
end;
$$;

create or replace function public.reorder_digital_product_assets(
  p_store_id uuid,
  p_product_id uuid,
  p_asset_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expected integer;
begin
  perform 1 from public.products p
  where p.id = p_product_id and p.store_id = p_store_id
  for update;
  if not found then raise exception 'Digital product unavailable'; end if;
  if cardinality(p_asset_ids) > public.digital_asset_max_active_files()
    or cardinality(p_asset_ids) <> (select count(distinct value) from unnest(p_asset_ids) value) then
    raise exception 'Invalid digital asset order';
  end if;
  select count(*) into v_expected from public.digital_product_assets a
  where a.product_id = p_product_id and a.store_id = p_store_id and a.active;
  if v_expected <> cardinality(p_asset_ids)
    or exists (
      select 1 from unnest(p_asset_ids) id
      where not exists (
        select 1 from public.digital_product_assets a
        where a.id = id and a.product_id = p_product_id
          and a.store_id = p_store_id and a.active
      )
    ) then
    raise exception 'Digital asset order does not match product';
  end if;
  update public.digital_product_assets a
  set sort_order = ordered.ordinality - 1
  from unnest(p_asset_ids) with ordinality ordered(id, ordinality)
  where a.id = ordered.id and a.product_id = p_product_id and a.store_id = p_store_id;
  return v_expected;
end;
$$;

create or replace function public.deactivate_digital_product_asset(
  p_store_id uuid,
  p_asset_id uuid
)
returns table(deactivated boolean, preserved_version_count integer, entitlement_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_versions integer;
  v_entitlements integer;
begin
  update public.digital_product_assets a set active = false
  where a.id = p_asset_id and a.store_id = p_store_id and a.active;
  if not found and not exists (
    select 1 from public.digital_product_assets a where a.id = p_asset_id and a.store_id = p_store_id
  ) then raise exception 'Digital asset unavailable'; end if;
  select count(*) into v_versions from public.digital_product_asset_versions v
  where v.asset_id = p_asset_id;
  select count(*) into v_entitlements from public.digital_order_entitlements e
  where e.asset_id = p_asset_id;
  return query select true, v_versions, v_entitlements;
end;
$$;

create or replace function public.begin_digital_product_preview(
  p_store_id uuid,
  p_product_id uuid,
  p_source_asset_version_id uuid
)
returns table(
  preview_status text,
  public_preview_path text,
  source_storage_path text,
  source_mime_type text,
  was_already_ready boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version public.digital_product_asset_versions%rowtype;
  v_preview public.digital_product_previews%rowtype;
begin
  select v.* into v_version
  from public.digital_product_asset_versions v
  join public.digital_product_assets a on a.id = v.asset_id
  where v.id = p_source_asset_version_id and v.store_id = p_store_id
    and v.product_id = p_product_id and v.status = 'ready'
    and v.retired_at is null and a.active
  for update of v;
  if not found then raise exception 'Digital preview source unavailable'; end if;
  select * into v_preview from public.digital_product_previews p
  where p.product_id = p_product_id and p.store_id = p_store_id
  for update;
  if found and v_preview.status = 'ready'
    and v_preview.source_asset_version_id = p_source_asset_version_id
    and not v_preview.is_merchant_override then
    return query select 'ready'::text, v_preview.public_preview_path,
      v_version.storage_path, v_version.mime_type, true;
    return;
  end if;
  insert into public.digital_product_previews(
    product_id, store_id, source_asset_version_id, status,
    public_preview_path, is_merchant_override, failure_reason
  ) values (
    p_product_id, p_store_id, p_source_asset_version_id, 'processing',
    null, false, null
  ) on conflict (product_id) do update set
    source_asset_version_id = excluded.source_asset_version_id,
    status = 'processing', public_preview_path = null,
    is_merchant_override = false, failure_reason = null;
  return query select 'processing'::text, null::text,
    v_version.storage_path, v_version.mime_type, false;
end;
$$;

create or replace function public.complete_digital_product_preview(
  p_store_id uuid,
  p_product_id uuid,
  p_source_asset_version_id uuid,
  p_public_preview_path text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_public_preview_path !~ ('^' || p_store_id::text || '/' || p_product_id::text || '/[a-zA-Z0-9._-]+$') then
    raise exception 'Invalid digital preview path';
  end if;
  update public.digital_product_previews p
  set status = 'ready', public_preview_path = p_public_preview_path,
      is_merchant_override = false, failure_reason = null
  where p.product_id = p_product_id and p.store_id = p_store_id
    and p.source_asset_version_id = p_source_asset_version_id
    and p.status = 'processing';
  if not found then raise exception 'Digital preview unavailable'; end if;
  return true;
end;
$$;

create or replace function public.fail_digital_product_preview(
  p_store_id uuid,
  p_product_id uuid,
  p_safe_error text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(char_length(trim(p_safe_error)), 0) not between 1 and 240 then
    raise exception 'Invalid safe preview error';
  end if;
  update public.digital_product_previews p
  set status = 'failed', public_preview_path = null,
      failure_reason = trim(p_safe_error)
  where p.product_id = p_product_id and p.store_id = p_store_id;
  return found;
end;
$$;

create or replace function public.validate_digital_preview_override(
  p_store_id uuid,
  p_product_id uuid,
  p_source_url text
)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.products p
    where p.id = p_product_id and p.store_id = p_store_id
  ) and p_source_url ~ (
    '^https://[^/]+/storage/v1/object/public/store-products/' ||
    p_store_id::text || '/[^?#]+$'
  )
$$;

create or replace function public.complete_digital_preview_override(
  p_store_id uuid,
  p_product_id uuid,
  p_public_preview_path text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.products p where p.id = p_product_id and p.store_id = p_store_id
  ) or p_public_preview_path !~ (
    '^' || p_store_id::text || '/' || p_product_id::text ||
    '/merchant-override-[a-f0-9]{64}\.jpg$'
  ) then raise exception 'Digital preview unavailable'; end if;
  insert into public.digital_product_previews(
    product_id, store_id, source_asset_version_id, source_asset_id,
    public_preview_path, status, is_merchant_override, failure_reason
  ) values (
    p_product_id, p_store_id, null, null, p_public_preview_path,
    'ready', true, null
  ) on conflict (product_id) do update set
    source_asset_version_id = null, source_asset_id = null,
    public_preview_path = excluded.public_preview_path,
    status = 'ready', is_merchant_override = true, failure_reason = null;
  return true;
end;
$$;

revoke all on table public.digital_asset_upload_intents from public, anon, authenticated;
grant select, insert, update, delete on table public.digital_asset_upload_intents to service_role;

revoke all on function public.digital_asset_safe_basename(text) from public, anon, authenticated;
revoke all on function public.digital_asset_max_active_files() from public, anon, authenticated;
revoke all on function public.digital_asset_max_file_bytes() from public, anon, authenticated;
revoke all on function public.digital_asset_max_intent_ttl() from public, anon, authenticated;
revoke all on function public.digital_asset_extension_for_mime(text, text) from public, anon, authenticated;
revoke all on function public.create_digital_asset_upload_intent(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, bigint, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.get_digital_asset_upload_intent(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fail_digital_asset_upload_intent(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.retry_digital_asset_upload_intent(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.finalize_digital_asset_upload_intent(uuid, uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.update_digital_product_asset(uuid, uuid, text, boolean, uuid, boolean) from public, anon, authenticated;
revoke all on function public.reorder_digital_product_assets(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.deactivate_digital_product_asset(uuid, uuid) from public, anon, authenticated;
revoke all on function public.begin_digital_product_preview(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_digital_product_preview(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.fail_digital_product_preview(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.validate_digital_preview_override(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.complete_digital_preview_override(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.digital_asset_safe_basename(text) to service_role;
grant execute on function public.digital_asset_max_active_files() to service_role;
grant execute on function public.digital_asset_max_file_bytes() to service_role;
grant execute on function public.digital_asset_max_intent_ttl() to service_role;
grant execute on function public.digital_asset_extension_for_mime(text, text) to service_role;
grant execute on function public.create_digital_asset_upload_intent(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, bigint, text, text, timestamptz) to service_role;
grant execute on function public.get_digital_asset_upload_intent(uuid, uuid) to service_role;
grant execute on function public.fail_digital_asset_upload_intent(uuid, uuid, text) to service_role;
grant execute on function public.retry_digital_asset_upload_intent(uuid, uuid, timestamptz) to service_role;
grant execute on function public.finalize_digital_asset_upload_intent(uuid, uuid, bigint, text, text) to service_role;
grant execute on function public.update_digital_product_asset(uuid, uuid, text, boolean, uuid, boolean) to service_role;
grant execute on function public.reorder_digital_product_assets(uuid, uuid, uuid[]) to service_role;
grant execute on function public.deactivate_digital_product_asset(uuid, uuid) to service_role;
grant execute on function public.begin_digital_product_preview(uuid, uuid, uuid) to service_role;
grant execute on function public.complete_digital_product_preview(uuid, uuid, uuid, text) to service_role;
grant execute on function public.fail_digital_product_preview(uuid, uuid, text) to service_role;
grant execute on function public.validate_digital_preview_override(uuid, uuid, text) to service_role;
grant execute on function public.complete_digital_preview_override(uuid, uuid, text) to service_role;
