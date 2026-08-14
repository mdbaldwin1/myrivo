-- Serialize every readiness mutation before PostgreSQL can lock a child tuple.
-- A BEFORE ROW trigger alone is insufficient for UPDATE/DELETE because the
-- executor can own the target tuple before invoking it. The transaction-level
-- advisory lock is therefore acquired by BEFORE STATEMENT triggers and at the
-- entry point of lifecycle RPCs that lock rows before issuing child DML.

create or replace function public.acquire_digital_readiness_mutation_lock()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('myrivo:digital-product-readiness:v1', 0)
  );
end;
$$;

create or replace function public.acquire_digital_readiness_mutation_before_statement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.acquire_digital_readiness_mutation_lock();
  return null;
end;
$$;

create or replace function public.lock_digital_readiness_product_before_child_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := to_jsonb(old);
  v_new_product_id uuid := nullif(v_new ->> 'product_id', '')::uuid;
  v_new_store_id uuid := nullif(v_new ->> 'store_id', '')::uuid;
  v_old_product_id uuid := nullif(v_old ->> 'product_id', '')::uuid;
  v_old_store_id uuid := nullif(v_old ->> 'store_id', '')::uuid;
  v_new_asset_id uuid;
  v_old_asset_id uuid;
begin
  -- Keep this defensive acquisition in addition to the statement trigger so a
  -- future trigger-definition change cannot silently omit the protocol.
  perform public.acquire_digital_readiness_mutation_lock();

  -- Current schemas persist product/store relations on asset versions, but
  -- resolve through the asset as a defensive fallback for legacy-shaped rows.
  if tg_table_name = 'digital_product_asset_versions' then
    v_new_asset_id := nullif(v_new ->> 'asset_id', '')::uuid;
    v_old_asset_id := nullif(v_old ->> 'asset_id', '')::uuid;

    if (v_new_product_id is null or v_new_store_id is null)
      and v_new_asset_id is not null
    then
      select asset.product_id, asset.store_id
      into v_new_product_id, v_new_store_id
      from public.digital_product_assets asset
      where asset.id = v_new_asset_id;
    end if;

    if (v_old_product_id is null or v_old_store_id is null)
      and v_old_asset_id is not null
    then
      select asset.product_id, asset.store_id
      into v_old_product_id, v_old_store_id
      from public.digital_product_assets asset
      where asset.id = v_old_asset_id;
    end if;
  end if;

  -- Lock both sides of a relation move in stable order. The statement-level
  -- advisory lock also makes the order deterministic across multi-row DML.
  perform 1
  from public.products product
  where (
      product.id = v_old_product_id
      and product.store_id = v_old_store_id
    ) or (
      product.id = v_new_product_id
      and product.store_id = v_new_store_id
    )
  order by product.id, product.store_id
  for share;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Install the transaction protocol before any child tuple can be selected for
-- mutation, then acquire its product row in the row trigger. All four child
-- tables participate because each can affect active-product deliverability.
do $$
declare
  v_table text;
  v_update_columns text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products'
      and column_name = 'status'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_variants'
      and column_name = 'status'
  ) then
    for v_table, v_update_columns in
      select * from (values
        ('product_variants', 'store_id, product_id, status'),
        ('digital_product_assets', 'store_id, product_id, product_variant_id, active'),
        ('digital_product_asset_versions', 'store_id, product_id, asset_id, status, retired_at'),
        ('digital_product_previews', 'store_id, product_id, status, public_preview_path')
      ) as readiness_tables(table_name, update_columns)
    loop
      execute format(
        'drop trigger if exists serialize_digital_readiness_before_statement on public.%I',
        v_table
      );
      execute format(
        'create trigger serialize_digital_readiness_before_statement
         before insert or delete or update of %s on public.%I
         for each statement execute function public.acquire_digital_readiness_mutation_before_statement()',
        v_update_columns,
        v_table
      );

      execute format(
        'drop trigger if exists lock_digital_readiness_product_before_mutation on public.%I',
        v_table
      );
      execute format(
        'create trigger lock_digital_readiness_product_before_mutation
         before insert or delete or update of %s on public.%I
         for each row execute function public.lock_digital_readiness_product_before_child_mutation()',
        v_update_columns,
        v_table
      );

      -- Replace the broad trigger from the prior migration with the same
      -- readiness-column scope. Non-readiness updates (for example checkout
      -- inventory decrements) do not enter this serialization protocol.
      execute format(
        'drop trigger if exists enforce_active_digital_product_readiness on public.%I',
        v_table
      );
      execute format(
        'create constraint trigger enforce_active_digital_product_readiness
         after insert or delete or update of %s on public.%I
         deferrable initially deferred
         for each row execute function public.enforce_active_digital_product_readiness()',
        v_update_columns,
        v_table
      );
    end loop;
  end if;
end;
$$;

-- Product readiness changes must enter the same protocol before the product
-- tuple is locked. Unrelated inventory/price updates retain their existing
-- concurrency characteristics.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products'
      and column_name = 'status'
  ) then
    drop trigger if exists serialize_digital_readiness_product_before_statement
    on public.products;
    create trigger serialize_digital_readiness_product_before_statement
    before insert or delete or update of
      product_type,
      status,
      digital_rights_affirmed_at,
      digital_rights_affirmed_by_user_id
    on public.products
    for each statement execute function public.acquire_digital_readiness_mutation_before_statement();

    drop trigger if exists enforce_active_digital_product_readiness
    on public.products;
    create constraint trigger enforce_active_digital_product_readiness
    after insert or delete or update of
      product_type,
      status,
      digital_rights_affirmed_at,
      digital_rights_affirmed_by_user_id
    on public.products
    deferrable initially deferred
    for each row execute function public.enforce_active_digital_product_readiness();
  end if;
end;
$$;

-- Lifecycle RPCs can lock a product, asset, version, or preview before their
-- first DML statement fires. Inject the protocol call at function entry so no
-- supported writer can acquire one of those rows before joining the protocol;
-- the existing per-product locks then retain their fine-grained ordering.
do $$
declare
  v_procedure regprocedure;
  v_definition text;
  v_body_begin integer;
  v_lock_call constant text :=
    E'begin\n  perform public.acquire_digital_readiness_mutation_lock();\n';
begin
  foreach v_procedure in array array[
    'public.apply_digital_product_catalog_update(uuid,uuid,uuid,jsonb,jsonb,jsonb)'::regprocedure,
    'public.create_digital_asset_upload_intent(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,bigint,text,text,timestamp with time zone)'::regprocedure,
    'public.finalize_digital_asset_upload_intent(uuid,uuid,bigint,text,text)'::regprocedure,
    'public.update_digital_product_asset(uuid,uuid,text,boolean,uuid,boolean)'::regprocedure,
    'public.reorder_digital_product_assets(uuid,uuid,uuid[])'::regprocedure,
    'public.begin_digital_product_preview(uuid,uuid,uuid)'::regprocedure,
    'public.complete_digital_preview_override(uuid,uuid,text)'::regprocedure
  ] loop
    select pg_get_functiondef(v_procedure) into v_definition;
    if strpos(v_definition, 'perform public.acquire_digital_readiness_mutation_lock();') > 0 then
      continue;
    end if;

    v_body_begin := strpos(v_definition, E'begin\n');
    if v_body_begin = 0 then
      raise exception 'Unable to install digital readiness lock in %', v_procedure;
    end if;

    execute overlay(
      v_definition placing v_lock_call
      from v_body_begin for length(E'begin\n')
    );
  end loop;
end;
$$;

revoke all on function public.acquire_digital_readiness_mutation_lock()
from public, anon, authenticated;
revoke all on function public.acquire_digital_readiness_mutation_before_statement()
from public, anon, authenticated;
revoke all on function public.lock_digital_readiness_product_before_child_mutation()
from public, anon, authenticated;
