-- Close the remaining upload/preview races with durable expiry transitions,
-- one active replacement per asset, and leased preview generations.

create or replace function public.digital_preview_processing_lease()
returns interval
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$ select interval '15 minutes' $$;

-- An elapsed pending intent must become cleanup-eligible without raising in the
-- same transaction, because a raised exception would roll the transition back.
create or replace function public.expire_digital_asset_upload_intent(
  p_store_id uuid,
  p_intent_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.digital_asset_upload_intents i
  set status = 'expired', last_safe_error = 'Upload intent expired',
      cleanup_after = now()
  where i.id = p_intent_id and i.store_id = p_store_id
    and i.status = 'pending' and i.expires_at <= now();
  if found then return true; end if;

  return exists (
    select 1 from public.digital_asset_upload_intents i
    where i.id = p_intent_id and i.store_id = p_store_id
      and i.status = 'expired'
  );
end;
$$;

-- Normalize historical rows before enforcing one live replacement. Elapsed
-- work is expired; if legacy data contains duplicates, retain only the newest.
update public.digital_asset_upload_intents
set status = 'expired', last_safe_error = 'Upload intent expired',
    cleanup_after = now()
where status = 'pending' and expires_at <= now();

with ranked_replacements as (
  select id,
    row_number() over (
      partition by asset_id
      order by version_number desc, created_at desc, id desc
    ) as replacement_rank
  from public.digital_asset_upload_intents
  where operation = 'replace' and status = 'pending'
)
update public.digital_asset_upload_intents i
set status = 'failed',
    last_safe_error = 'Replacement upload superseded during upgrade',
    cleanup_after = now()
from ranked_replacements ranked
where i.id = ranked.id and ranked.replacement_rank > 1;

create unique index digital_asset_upload_intents_one_pending_replacement_key
  on public.digital_asset_upload_intents(asset_id)
  where operation = 'replace' and status = 'pending';

create or replace function public.expire_elapsed_digital_asset_replacement()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.operation = 'replace' then
    update public.digital_asset_upload_intents i
    set status = 'expired', last_safe_error = 'Upload intent expired',
        cleanup_after = now()
    where i.asset_id = new.asset_id and i.operation = 'replace'
      and i.status = 'pending' and i.expires_at <= now();
  end if;
  return new;
end;
$$;

create trigger digital_asset_upload_intents_expire_replacement
before insert on public.digital_asset_upload_intents
for each row execute function public.expire_elapsed_digital_asset_replacement();

-- Failed retries remain valid only while no newer intent/version exists. This
-- prevents an old browser tab from reactivating and finalizing an obsolete
-- replacement after a later version has already won.
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
declare
  v_intent public.digital_asset_upload_intents%rowtype;
begin
  if p_expires_at <= now()
    or p_expires_at > now() + public.digital_asset_max_intent_ttl() then
    raise exception 'Invalid digital asset upload expiry';
  end if;

  select * into v_intent
  from public.digital_asset_upload_intents i
  where i.id = p_intent_id and i.store_id = p_store_id
  for update;
  if not found or v_intent.status <> 'failed' then
    raise exception 'Digital asset upload unavailable';
  end if;
  if v_intent.operation = 'replace' and (
    exists (
      select 1 from public.digital_asset_upload_intents newer
      where newer.asset_id = v_intent.asset_id
        and newer.version_number > v_intent.version_number
    )
    or exists (
      select 1 from public.digital_product_asset_versions newer
      where newer.asset_id = v_intent.asset_id
        and newer.version_number >= v_intent.version_number
    )
  ) then
    raise exception 'Digital asset replacement superseded';
  end if;

  update public.digital_asset_upload_intents i
  set status = 'pending', expires_at = p_expires_at, last_safe_error = null,
      cleanup_after = null, orphaned_at = null
  where i.id = v_intent.id;

  return query
  select i.id, i.asset_id, i.asset_version_id, i.product_id,
    i.product_variant_id, i.storage_path, i.expected_filename,
    i.expected_mime_type, i.expected_byte_size, i.version_number, i.operation,
    i.status, i.expires_at, i.completed_version_id
  from public.digital_asset_upload_intents i
  where i.id = v_intent.id;
end;
$$;

-- Recreate to add an explicit, nonthrowing expired outcome. This keeps the
-- persisted expiry/cleanup state committed while callers return a neutral 409.
drop function public.finalize_digital_asset_upload_intent(uuid, uuid, bigint, text, text);

create function public.finalize_digital_asset_upload_intent(
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
  was_already_completed boolean,
  finalization_status text
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
      v_intent.version_number, true, 'already_completed'::text;
    return;
  end if;
  if v_intent.status = 'expired' then
    return query select v_intent.asset_id, v_intent.asset_version_id,
      v_intent.product_id, v_intent.expected_mime_type,
      v_intent.version_number, false, 'expired'::text;
    return;
  end if;
  if v_intent.status <> 'pending' then
    raise exception 'Digital asset upload unavailable';
  end if;
  if v_intent.expires_at <= now() then
    update public.digital_asset_upload_intents
    set status = 'expired', last_safe_error = 'Upload intent expired',
        cleanup_after = now()
    where id = v_intent.id;
    return query select v_intent.asset_id, v_intent.asset_version_id,
      v_intent.product_id, v_intent.expected_mime_type,
      v_intent.version_number, false, 'expired'::text;
    return;
  end if;
  if p_actual_byte_size is distinct from v_intent.expected_byte_size
    or p_detected_mime_type is distinct from v_intent.expected_mime_type
    or p_checksum_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'Digital asset verification mismatch';
  end if;
  if v_intent.operation = 'replace' and (
    exists (
      select 1 from public.digital_asset_upload_intents newer
      where newer.asset_id = v_intent.asset_id
        and newer.version_number > v_intent.version_number
    )
    or exists (
      select 1 from public.digital_product_asset_versions newer
      where newer.asset_id = v_intent.asset_id
        and newer.version_number >= v_intent.version_number
    )
  ) then
    raise exception 'Digital asset replacement superseded';
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
    v_intent.version_number, false, 'completed'::text;
end;
$$;

-- Every processing attempt owns a renewable lease generation. Later attempts
-- and merchant overrides invalidate stale workers without allowing clobbers.
alter table public.digital_product_previews
  add column processing_generation uuid default gen_random_uuid(),
  add column processing_lease_expires_at timestamptz;

update public.digital_product_previews
set processing_generation = coalesce(processing_generation, gen_random_uuid()),
    processing_lease_expires_at = case when status = 'processing' then now() else null end;

alter table public.digital_product_previews
  alter column processing_generation set not null,
  add constraint digital_product_previews_processing_lease_check check (
    (status = 'processing' and processing_lease_expires_at is not null)
    or (status <> 'processing' and processing_lease_expires_at is null)
  );

drop function public.begin_digital_product_preview(uuid, uuid, uuid);

create function public.begin_digital_product_preview(
  p_store_id uuid,
  p_product_id uuid,
  p_source_asset_version_id uuid
)
returns table(
  preview_status text,
  public_preview_path text,
  source_storage_path text,
  source_mime_type text,
  was_already_ready boolean,
  processing_acquired boolean,
  processing_generation uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version public.digital_product_asset_versions%rowtype;
  v_preview public.digital_product_previews%rowtype;
  v_generation uuid;
begin
  perform 1 from public.products p
  where p.id = p_product_id and p.store_id = p_store_id
  for update;
  if not found then raise exception 'Digital preview source unavailable'; end if;

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
      v_version.storage_path, v_version.mime_type, true, false, null::uuid;
    return;
  end if;
  if found and v_preview.status = 'processing'
    and v_preview.source_asset_version_id = p_source_asset_version_id
    and v_preview.processing_lease_expires_at > now() then
    return query select 'processing'::text, null::text,
      v_version.storage_path, v_version.mime_type, false, false, null::uuid;
    return;
  end if;

  v_generation := gen_random_uuid();
  insert into public.digital_product_previews(
    product_id, store_id, source_asset_version_id, status,
    public_preview_path, is_merchant_override, failure_reason,
    processing_generation, processing_lease_expires_at
  ) values (
    p_product_id, p_store_id, p_source_asset_version_id, 'processing',
    null, false, null, v_generation,
    now() + public.digital_preview_processing_lease()
  ) on conflict (product_id) do update set
    source_asset_version_id = excluded.source_asset_version_id,
    status = 'processing', public_preview_path = null,
    is_merchant_override = false, failure_reason = null,
    processing_generation = excluded.processing_generation,
    processing_lease_expires_at = excluded.processing_lease_expires_at;
  return query select 'processing'::text, null::text,
    v_version.storage_path, v_version.mime_type, false, true, v_generation;
end;
$$;

drop function public.complete_digital_product_preview(uuid, uuid, uuid, text);

create function public.complete_digital_product_preview(
  p_store_id uuid,
  p_product_id uuid,
  p_source_asset_version_id uuid,
  p_public_preview_path text,
  p_processing_generation uuid
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
      is_merchant_override = false, failure_reason = null,
      processing_lease_expires_at = null
  where p.product_id = p_product_id and p.store_id = p_store_id
    and p.source_asset_version_id = p_source_asset_version_id
    and p.status = 'processing'
    and p.processing_generation = p_processing_generation
    and p.processing_lease_expires_at > now();
  return found;
end;
$$;

drop function public.fail_digital_product_preview(uuid, uuid, text);

create function public.fail_digital_product_preview(
  p_store_id uuid,
  p_product_id uuid,
  p_processing_generation uuid,
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
      failure_reason = trim(p_safe_error), processing_lease_expires_at = null
  where p.product_id = p_product_id and p.store_id = p_store_id
    and p.status = 'processing'
    and p.processing_generation = p_processing_generation;
  return found;
end;
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
declare
  v_generation uuid := gen_random_uuid();
begin
  if p_public_preview_path !~ (
    '^' || p_store_id::text || '/' || p_product_id::text ||
    '/merchant-override-[a-f0-9]{64}\.jpg$'
  ) then raise exception 'Digital preview unavailable'; end if;
  perform 1 from public.products p
  where p.id = p_product_id and p.store_id = p_store_id
  for update;
  if not found then raise exception 'Digital preview unavailable'; end if;

  insert into public.digital_product_previews(
    product_id, store_id, source_asset_version_id, source_asset_id,
    public_preview_path, status, is_merchant_override, failure_reason,
    processing_generation, processing_lease_expires_at
  ) values (
    p_product_id, p_store_id, null, null, p_public_preview_path,
    'ready', true, null, v_generation, null
  ) on conflict (product_id) do update set
    source_asset_version_id = null, source_asset_id = null,
    public_preview_path = excluded.public_preview_path,
    status = 'ready', is_merchant_override = true, failure_reason = null,
    processing_generation = excluded.processing_generation,
    processing_lease_expires_at = null;
  return true;
end;
$$;

revoke all on function public.digital_preview_processing_lease() from public, anon, authenticated;
revoke all on function public.expire_digital_asset_upload_intent(uuid, uuid) from public, anon, authenticated;
revoke all on function public.expire_elapsed_digital_asset_replacement() from public, anon, authenticated;
revoke all on function public.retry_digital_asset_upload_intent(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.finalize_digital_asset_upload_intent(uuid, uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.begin_digital_product_preview(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_digital_product_preview(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.fail_digital_product_preview(uuid, uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.digital_preview_processing_lease() to service_role;
grant execute on function public.expire_digital_asset_upload_intent(uuid, uuid) to service_role;
grant execute on function public.retry_digital_asset_upload_intent(uuid, uuid, timestamptz) to service_role;
grant execute on function public.finalize_digital_asset_upload_intent(uuid, uuid, bigint, text, text) to service_role;
grant execute on function public.begin_digital_product_preview(uuid, uuid, uuid) to service_role;
grant execute on function public.complete_digital_product_preview(uuid, uuid, uuid, text, uuid) to service_role;
grant execute on function public.fail_digital_product_preview(uuid, uuid, uuid, text) to service_role;
