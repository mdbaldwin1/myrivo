import { execFile, execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DIGITAL_PRODUCT_CONFIG } from "@/lib/digital-products/config";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const prototypeMigration = join(
  repoRoot,
  "supabase/migrations/20260812170000_native_digital_products.sql",
);
const hardeningMigration = join(
  repoRoot,
  "supabase/migrations/20260812180000_harden_digital_products.sql",
);
const assetLifecycleMigration = join(
  repoRoot,
  "supabase/migrations/20260812190000_transactional_digital_assets.sql",
);
const assetLifecycleConcurrencyMigration = join(
  repoRoot,
  "supabase/migrations/20260812200000_harden_digital_asset_concurrency.sql",
);
const previewCanonicalPathMigration = join(
  repoRoot,
  "supabase/migrations/20260812210000_enforce_digital_preview_canonical_paths.sql",
);
const publishingReadinessMigration = join(
  repoRoot,
  "supabase/migrations/20260812220000_digital_product_publishing_readiness.sql",
);
const publishingReadinessSerializationMigration = join(
  repoRoot,
  "supabase/migrations/20260812230000_serialize_digital_publish_readiness.sql",
);
const publishingReadinessChildLockMigration = join(
  repoRoot,
  "supabase/migrations/20260812231000_lock_readiness_products_before_children.sql",
);
const publishingReadinessRelationMoveMigration = join(
  repoRoot,
  "supabase/migrations/20260812232000_validate_digital_readiness_relation_moves.sql",
);
const checkoutManifestMigration = join(
  repoRoot,
  "supabase/migrations/20260813000000_digital_checkout_manifests.sql",
);
const checkoutAttemptRecoveryMigration = join(
  repoRoot,
  "supabase/migrations/20260813001000_checkout_attempt_recovery.sql",
);
const checkoutAttemptHardeningMigration = join(
  repoRoot,
  "supabase/migrations/20260813002000_checkout_attempt_recovery_hardening.sql",
);
const digitalCheckoutCompositionMigration = join(
  repoRoot,
  "supabase/migrations/20260813003000_digital_checkout_composition.sql",
);
const digitalCheckoutPolicyMigration = join(
  repoRoot,
  "supabase/migrations/20260813004000_enforce_digital_checkout_policy.sql",
);
const authoritativeDigitalCheckoutPolicyMigration = join(
  repoRoot,
  "supabase/migrations/20260813005000_enforce_authoritative_digital_checkout_policy.sql",
);
const checkoutSnapshotAndCartRepairMigration = join(
  repoRoot,
  "supabase/migrations/20260813006000_enforce_checkout_snapshot_and_repair_carts.sql",
);
const serializedCartMutationsMigration = join(
  repoRoot,
  "supabase/migrations/20260813007000_serialize_authenticated_cart_mutations.sql",
);
const durableDigitalDeliveryMigration = join(
  repoRoot,
  "supabase/migrations/20260813008000_durable_digital_delivery.sql",
);

const ids = {
  storeA: "10000000-0000-0000-0000-000000000001",
  storeB: "10000000-0000-0000-0000-000000000002",
  productA: "20000000-0000-0000-0000-000000000001",
  productA2: "20000000-0000-0000-0000-000000000002",
  productB: "20000000-0000-0000-0000-000000000003",
  variantA: "30000000-0000-0000-0000-000000000001",
  variantA2: "30000000-0000-0000-0000-000000000002",
  variantB: "30000000-0000-0000-0000-000000000003",
  orderA: "40000000-0000-0000-0000-000000000001",
  orderA2: "40000000-0000-0000-0000-000000000002",
  orderB: "40000000-0000-0000-0000-000000000003",
  itemA: "50000000-0000-0000-0000-000000000001",
  itemA2: "50000000-0000-0000-0000-000000000002",
  itemB: "50000000-0000-0000-0000-000000000003",
  assetA: "60000000-0000-0000-0000-000000000001",
  assetA2: "60000000-0000-0000-0000-000000000002",
  assetB: "60000000-0000-0000-0000-000000000003",
  versionA: "70000000-0000-0000-0000-000000000001",
  versionA2: "70000000-0000-0000-0000-000000000002",
  versionB: "70000000-0000-0000-0000-000000000003",
  entitlementA: "80000000-0000-0000-0000-000000000001",
  entitlementReserve: "80000000-0000-0000-0000-000000000002",
  tokenA: "90000000-0000-0000-0000-000000000001",
  legacyGrant: "a0000000-0000-0000-0000-000000000001",
  manifestA: "b0000000-0000-0000-0000-000000000001",
  manifestItemA: "c0000000-0000-0000-0000-000000000001",
  manifestStore: "12000000-0000-4000-8000-000000000001",
  manifestProduct: "22000000-0000-4000-8000-000000000001",
  manifestPhysicalProduct: "22000000-0000-4000-8000-000000000002",
  manifestVariant: "32000000-0000-4000-8000-000000000001",
  manifestPhysicalVariant: "32000000-0000-4000-8000-000000000002",
  manifestCheckout: "42000000-0000-4000-8000-000000000001",
  manifestConcurrentCheckout: "42000000-0000-4000-8000-000000000002",
  manifestOrder: "42000000-0000-4000-8000-000000000003",
  manifestOrderItem: "52000000-0000-4000-8000-000000000001",
  manifestPhysicalOrderItem: "52000000-0000-4000-8000-000000000002",
  manifestProductWideAsset: "62000000-0000-4000-8000-000000000001",
  manifestVariantAsset: "62000000-0000-4000-8000-000000000002",
  manifestOtherVariantAsset: "62000000-0000-4000-8000-000000000003",
  manifestProductWideV1: "72000000-0000-4000-8000-000000000001",
  manifestProductWideV2: "72000000-0000-4000-8000-000000000002",
  manifestVariantV1: "72000000-0000-4000-8000-000000000003",
  policyUpgradeStore: "12000000-0000-4000-8000-000000000041",
  policyUpgradeCheckout: "42000000-0000-4000-8000-000000000041",
  legacyNullCheckout: "42000000-0000-4000-8000-000000000042",
  cartRepairCart: "42000000-0000-4000-8000-000000000051",
  cartDigitalProduct: "22000000-0000-4000-8000-000000000051",
  cartDigitalVariant: "32000000-0000-4000-8000-000000000051",
  cartChangedProduct: "22000000-0000-4000-8000-000000000052",
  cartChangedVariant: "32000000-0000-4000-8000-000000000052",
  cartArchivedProduct: "22000000-0000-4000-8000-000000000053",
  cartArchivedVariant: "32000000-0000-4000-8000-000000000053",
  cartChangedAsset: "62000000-0000-4000-8000-000000000051",
  cartChangedVersion: "72000000-0000-4000-8000-000000000051",
} as const;

const baseSchema = `
create extension if not exists pgcrypto;
create schema auth;
create table auth.users (id uuid primary key);
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null
);
alter table storage.objects enable row level security;

create function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.can_manage_store_membership_for_store(uuid)
returns boolean language sql stable as $$ select false $$;

create table public.stores (
  id uuid primary key,
  owner_user_id uuid not null references auth.users(id),
  name text not null default 'Store'
);
create table public.products (
  id uuid primary key,
  store_id uuid not null references public.stores(id),
  title text not null default 'Product'
);
create table public.product_variants (
  id uuid primary key,
  store_id uuid not null references public.stores(id),
  product_id uuid not null references public.products(id)
);
create table public.orders (
  id uuid primary key,
  store_id uuid not null references public.stores(id),
  customer_email text not null default 'customer@example.test',
  status text not null default 'paid'
);
create table public.order_items (
  id uuid primary key,
  order_id uuid not null references public.orders(id),
  product_id uuid not null references public.products(id),
  product_variant_id uuid references public.product_variants(id)
);
create table public.storefront_checkout_sessions (
  id uuid primary key,
  store_id uuid not null references public.stores(id),
  order_id uuid references public.orders(id)
);
`;

const supabaseFoundationSchema = `
create schema auth;
create function auth.uid() returns uuid language sql stable as 'select null::uuid';
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null
);
alter table storage.objects enable row level security;
`;

const prototypeFixtures = `
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001');
insert into public.stores(id, owner_user_id) values
  ('${ids.storeA}', '00000000-0000-0000-0000-000000000001'),
  ('${ids.storeB}', '00000000-0000-0000-0000-000000000001');
insert into public.products(id, store_id) values
  ('${ids.productA}', '${ids.storeA}'),
  ('${ids.productA2}', '${ids.storeA}'),
  ('${ids.productB}', '${ids.storeB}');
update public.products set product_type = 'digital';
insert into public.product_variants(id, store_id, product_id) values
  ('${ids.variantA}', '${ids.storeA}', '${ids.productA}'),
  ('${ids.variantA2}', '${ids.storeA}', '${ids.productA2}'),
  ('${ids.variantB}', '${ids.storeB}', '${ids.productB}');
insert into public.orders(id, store_id) values
  ('${ids.orderA}', '${ids.storeA}'),
  ('${ids.orderA2}', '${ids.storeA}'),
  ('${ids.orderB}', '${ids.storeB}');
insert into public.order_items(id, order_id, product_id, product_variant_id) values
  ('${ids.itemA}', '${ids.orderA}', '${ids.productA}', '${ids.variantA}'),
  ('${ids.itemA2}', '${ids.orderA2}', '${ids.productA2}', '${ids.variantA2}'),
  ('${ids.itemB}', '${ids.orderB}', '${ids.productB}', '${ids.variantB}');

insert into public.digital_product_assets(id, store_id, product_id, product_variant_id, label) values
  ('${ids.assetA}', '${ids.storeA}', '${ids.productA}', '${ids.variantA}', 'File A'),
  ('${ids.assetA2}', '${ids.storeA}', '${ids.productA2}', '${ids.variantA2}', 'File A2'),
  ('${ids.assetB}', '${ids.storeB}', '${ids.productB}', '${ids.variantB}', 'File B');
insert into public.digital_product_asset_versions(
  id, asset_id, version_number, storage_path, customer_filename, mime_type,
  byte_size, checksum_sha256, status
) values
  ('${ids.versionA}', '${ids.assetA}', 1, 'private/a', 'a.pdf', 'application/pdf', 10, repeat('a', 64), 'ready'),
  ('${ids.versionA2}', '${ids.assetA2}', 1, 'private/a2', 'a2.pdf', 'application/pdf', 10, repeat('b', 64), 'ready'),
  ('${ids.versionB}', '${ids.assetB}', 1, 'private/b', 'b.pdf', 'application/pdf', 10, repeat('c', 64), 'ready');
insert into public.digital_order_entitlements(
  id, store_id, order_id, order_item_id, product_id, product_variant_id,
  asset_id, asset_version_id, customer_filename, mime_type, byte_size,
  license_version, download_grants_used
) values (
  '${ids.entitlementA}', '${ids.storeA}', '${ids.orderA}', '${ids.itemA}',
  '${ids.productA}', '${ids.variantA}', '${ids.assetA}', '${ids.versionA}',
  'a.pdf', 'application/pdf', 10, 'personal-use-v1', 1
);
insert into public.digital_order_access_tokens(id, order_id, token_hash, issuance_reason, expires_at)
values ('${ids.tokenA}', '${ids.orderA}', repeat('d', 64), 'purchase', now() + interval '1 day');
insert into public.digital_download_grants(
  id, entitlement_id, access_token_id, reservation_key, status
) values (
  '${ids.legacyGrant}', '${ids.entitlementA}', '${ids.tokenA}', 'legacy-reservation', 'issued'
);
`;

let clusterDirectory: string;
let port: number;

function findPostgresBinary(name: string) {
  const configuredDirectory = process.env.POSTGRES_BIN;
  const candidates = [
    configuredDirectory ? join(configuredDirectory, name) : null,
    `/opt/homebrew/opt/postgresql@17/bin/${name}`,
    `/opt/homebrew/opt/postgresql@16/bin/${name}`,
    name,
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  });
}

const initdb = findPostgresBinary("initdb");
const pgCtl = findPostgresBinary("pg_ctl");
const createdb = findPostgresBinary("createdb");
const psql = findPostgresBinary("psql");

function postgresEnvironment(database = "postgres") {
  return {
    ...process.env,
    PGDATABASE: database,
    PGHOST: "127.0.0.1",
    PGPORT: String(port),
    PGUSER: "postgres",
  };
}

function runSql(database: string, statement: string) {
  if (!psql) {
    throw new Error("PostgreSQL psql is required for migration contract tests");
  }

  return execFileSync(psql, ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", statement], {
    encoding: "utf8",
    env: postgresEnvironment(database),
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runSqlAsync(database: string, statement: string, applicationName: string) {
  if (!psql) {
    return Promise.reject(
      new Error("PostgreSQL psql is required for migration contract tests"),
    );
  }

  return new Promise<string>((resolvePromise, rejectPromise) => {
    execFile(
      psql,
      ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", statement],
      {
        encoding: "utf8",
        env: { ...postgresEnvironment(database), PGAPPNAME: applicationName },
      },
      (error, stdout, stderr) => {
        if (error) {
          rejectPromise(new Error(stderr.trim() || error.message));
          return;
        }
        resolvePromise(stdout.trim());
      },
    );
  });
}

async function waitForPostgresSession(database: string, applicationName: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const waiting = runSql(
      database,
      `select count(*) from pg_stat_activity
       where application_name = '${applicationName}'
         and state = 'active'
         and query like '%pg_sleep%'`,
    );
    if (waiting === "1") return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
  throw new Error(`PostgreSQL session ${applicationName} did not reach its race barrier`);
}

async function waitForPostgresLock(database: string, applicationName: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const waiting = runSql(
      database,
      `select count(*) from pg_stat_activity
       where application_name = '${applicationName}'
         and state = 'active'
         and wait_event_type = 'Lock'`,
    );
    if (waiting === "1") return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
  throw new Error(`PostgreSQL session ${applicationName} did not reach its lock barrier`);
}

function applyMigration(database: string, path: string) {
  runSql(database, readFileSync(path, "utf8"));
}

function expectRejected(database: string, statement: string) {
  expect(() => runSql(database, statement)).toThrow();
}

beforeAll(() => {
  if (!initdb || !pgCtl || !createdb || !psql) {
    throw new Error(
      "PostgreSQL initdb, pg_ctl, createdb, and psql are required for migration contract tests",
    );
  }
  if (!existsSync(hardeningMigration)) {
    throw new Error(`Missing hardening migration: ${hardeningMigration}`);
  }
  if (!existsSync(assetLifecycleMigration)) {
    throw new Error(`Missing asset lifecycle migration: ${assetLifecycleMigration}`);
  }
  if (!existsSync(assetLifecycleConcurrencyMigration)) {
    throw new Error(
      `Missing asset lifecycle concurrency migration: ${assetLifecycleConcurrencyMigration}`,
    );
  }
  if (!existsSync(previewCanonicalPathMigration)) {
    throw new Error(`Missing preview canonical path migration: ${previewCanonicalPathMigration}`);
  }
  if (!existsSync(publishingReadinessMigration)) {
    throw new Error(`Missing publishing readiness migration: ${publishingReadinessMigration}`);
  }
  if (!existsSync(publishingReadinessSerializationMigration)) {
    throw new Error(
      `Missing publishing readiness serialization migration: ${publishingReadinessSerializationMigration}`,
    );
  }
  if (!existsSync(publishingReadinessChildLockMigration)) {
    throw new Error(
      `Missing publishing readiness child lock migration: ${publishingReadinessChildLockMigration}`,
    );
  }
  if (!existsSync(publishingReadinessRelationMoveMigration)) {
    throw new Error(
      `Missing publishing readiness relation move migration: ${publishingReadinessRelationMoveMigration}`,
    );
  }
  if (!existsSync(checkoutManifestMigration)) {
    throw new Error(`Missing checkout manifest migration: ${checkoutManifestMigration}`);
  }
  if (!existsSync(checkoutAttemptRecoveryMigration)) {
    throw new Error(`Missing checkout attempt recovery migration: ${checkoutAttemptRecoveryMigration}`);
  }
  if (!existsSync(checkoutAttemptHardeningMigration)) {
    throw new Error(`Missing checkout attempt hardening migration: ${checkoutAttemptHardeningMigration}`);
  }
  if (!existsSync(digitalCheckoutCompositionMigration)) {
    throw new Error(`Missing digital checkout composition migration: ${digitalCheckoutCompositionMigration}`);
  }
  if (!existsSync(digitalCheckoutPolicyMigration)) {
    throw new Error(`Missing digital checkout policy migration: ${digitalCheckoutPolicyMigration}`);
  }
  if (!existsSync(authoritativeDigitalCheckoutPolicyMigration)) {
    throw new Error(`Missing authoritative digital checkout policy migration: ${authoritativeDigitalCheckoutPolicyMigration}`);
  }
  if (!existsSync(checkoutSnapshotAndCartRepairMigration)) {
    throw new Error(`Missing checkout snapshot and cart repair migration: ${checkoutSnapshotAndCartRepairMigration}`);
  }
  if (!existsSync(serializedCartMutationsMigration)) {
    throw new Error(`Missing serialized cart mutations migration: ${serializedCartMutationsMigration}`);
  }
  if (!existsSync(durableDigitalDeliveryMigration)) {
    throw new Error(`Missing durable digital delivery migration: ${durableDigitalDeliveryMigration}`);
  }

  clusterDirectory = mkdtempSync(join(tmpdir(), "myrivo-digital-migration-"));
  port = 55432 + (process.pid % 9000);
  execFileSync(initdb, ["-D", clusterDirectory, "-A", "trust", "-U", "postgres", "--no-locale"], {
    stdio: "ignore",
  });
  execFileSync(
    pgCtl,
    ["-D", clusterDirectory, "-o", `-F -p ${port} -h 127.0.0.1`, "-w", "start"],
    { stdio: "ignore" },
  );
  runSql(
    "postgres",
    "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;",
  );

  for (const database of ["fresh", "upgrade"]) {
    execFileSync(createdb, [database], { env: postgresEnvironment(), stdio: "ignore" });
    runSql(database, baseSchema);
    applyMigration(database, prototypeMigration);
    if (database === "upgrade") {
      runSql(database, prototypeFixtures);
    }
    applyMigration(database, hardeningMigration);
    applyMigration(database, assetLifecycleMigration);
    if (database === "upgrade") {
      runSql(
        database,
        `insert into public.digital_product_assets(
          id, store_id, product_id, product_variant_id, label
        ) values (
          '60000000-0000-4000-8000-000000000030', '${ids.storeA}',
          '${ids.productA}', '${ids.variantA}', 'Upgrade replacement fixture'
        );
        insert into public.digital_product_asset_versions(
          id, asset_id, version_number, storage_path, customer_filename,
          mime_type, byte_size, checksum_sha256, status
        ) values (
          '70000000-0000-4000-8000-000000000029',
          '60000000-0000-4000-8000-000000000030', 1, 'private/upgrade-v1',
          'upgrade-v1.pdf', 'application/pdf', 10, repeat('e', 64), 'ready'
        );
        select * from public.create_digital_asset_upload_intent(
          'd0000000-0000-4000-8000-000000000030', '${ids.storeA}', null, null,
          '60000000-0000-4000-8000-000000000030',
          '70000000-0000-4000-8000-000000000030',
          '60000000-0000-4000-8000-000000000030',
          null, 'upgrade-older.pdf', 'application/pdf', 10, null, 'replace',
          now() + interval '30 minutes'
        );
        select * from public.create_digital_asset_upload_intent(
          'd0000000-0000-4000-8000-000000000031', '${ids.storeA}', null, null,
          '60000000-0000-4000-8000-000000000030',
          '70000000-0000-4000-8000-000000000031',
          '60000000-0000-4000-8000-000000000030',
          null, 'upgrade-newer.pdf', 'application/pdf', 10, null, 'replace',
          now() + interval '30 minutes'
        )`,
      );
    }
    applyMigration(database, assetLifecycleConcurrencyMigration);
    applyMigration(database, previewCanonicalPathMigration);
    applyMigration(database, publishingReadinessMigration);
    applyMigration(database, publishingReadinessSerializationMigration);
    applyMigration(database, publishingReadinessChildLockMigration);
    applyMigration(database, publishingReadinessRelationMoveMigration);
    applyMigration(database, checkoutManifestMigration);
    applyMigration(database, durableDigitalDeliveryMigration);
  }

  execFileSync(createdb, ["full_chain"], {
    env: postgresEnvironment(),
    stdio: "ignore",
  });
  runSql("full_chain", supabaseFoundationSchema);
  const migrationsDirectory = join(repoRoot, "supabase/migrations");
  for (const migration of readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    if (migration === "20260813004000_enforce_digital_checkout_policy.sql") {
      runSql(
        "full_chain",
        `insert into auth.users(id, email) values
          ('00000000-0000-4000-8000-000000000041', 'policy-upgrade@example.test');
        insert into public.stores(id, owner_user_id, name, slug, status) values (
          '${ids.policyUpgradeStore}', '00000000-0000-4000-8000-000000000041',
          'Policy Upgrade Store', 'policy-upgrade-store', 'live'
        );
        insert into public.storefront_checkout_sessions(
          id, store_id, store_slug, customer_email, items, checkout_composition,
          fulfillment_method, fulfillment_label, shipping_fee_cents, checkout_mode,
          tax_collection_mode_snapshot, applied_promotions_json, status,
          checkout_attempt_key, checkout_request_fingerprint_sha256
        ) values (
          '${ids.policyUpgradeCheckout}', '${ids.policyUpgradeStore}',
          'policy-upgrade-store', 'legacy-policy@example.test',
          jsonb_build_array(jsonb_build_object(
            'productId', '22000000-0000-4000-8000-000000000041',
            'variantId', '32000000-0000-4000-8000-000000000041',
            'quantity', 1, 'productType', 'digital', 'unitPriceCents', 100
          )),
          'digital_only', 'digital_delivery', 'Digital delivery', 0, 'stub',
          'seller_attested_no_tax', '[]'::jsonb, 'pending',
          '018f6fc1-8adc-7f43-8000-000000000641', '${"c".repeat(64)}'
        )`,
      );
    }
    if (migration === "20260813006000_enforce_checkout_snapshot_and_repair_carts.sql") {
      runSql(
        "full_chain",
        `insert into public.products(
           id, store_id, title, description, price_cents, inventory_qty, status, product_type
         ) values (
           '22000000-0000-4000-8000-000000000042', '${ids.policyUpgradeStore}',
           'Legacy physical', '', 100, 1, 'active', 'physical'
         );
         insert into public.product_variants(
           id, store_id, product_id, price_cents, inventory_qty, is_default, status
         ) values (
           '32000000-0000-4000-8000-000000000042', '${ids.policyUpgradeStore}',
           '22000000-0000-4000-8000-000000000042', 100, 1, true, 'active'
         );
         insert into public.storefront_checkout_sessions(
           id, store_id, store_slug, customer_email, items, checkout_composition, status
         ) values (
           '${ids.legacyNullCheckout}', '${ids.policyUpgradeStore}', 'policy-upgrade-store',
           'legacy-null@example.test', jsonb_build_array(jsonb_build_object(
             'productId', '22000000-0000-4000-8000-000000000042',
             'variantId', '32000000-0000-4000-8000-000000000042',
             'quantity', 1, 'productType', 'physical', 'unitPriceCents', 100
           )), null, 'pending'
         )`,
      );
    }
    applyMigration("full_chain", join(migrationsDirectory, migration));
  }

  runSql(
    "full_chain",
    `insert into auth.users(id, email) values
      ('00000000-0000-4000-8000-000000000011', 'manifest-owner@example.test');
    insert into public.stores(id, owner_user_id, name, slug, status) values (
      '${ids.manifestStore}', '00000000-0000-4000-8000-000000000011',
      'Manifest Store', 'manifest-store', 'live'
    );
    insert into public.products(
      id, store_id, title, description, price_cents, inventory_qty, status,
      product_type, digital_rights_affirmed_at, digital_rights_affirmed_by_user_id
    ) values (
      '${ids.manifestProduct}', '${ids.manifestStore}', 'Digital set', '', 2500, 100,
      'draft', 'digital', now(), '00000000-0000-4000-8000-000000000011'
    ), (
      '${ids.manifestPhysicalProduct}', '${ids.manifestStore}', 'Frame', '', 1500, 100,
      'active', 'physical', null, null
    );
    insert into public.product_variants(
      id, store_id, product_id, title, price_cents, inventory_qty, is_default, status, sort_order
    ) values (
      '${ids.manifestVariant}', '${ids.manifestStore}', '${ids.manifestProduct}',
      'Blue', 2500, 100, true, 'active', 0
    ), (
      '${ids.manifestPhysicalVariant}', '${ids.manifestStore}', '${ids.manifestPhysicalProduct}',
      'Oak', 1500, 100, true, 'active', 0
    );
    insert into public.digital_product_assets(
      id, store_id, product_id, product_variant_id, label, sort_order, active
    ) values (
      '${ids.manifestProductWideAsset}', '${ids.manifestStore}', '${ids.manifestProduct}',
      null, 'Instructions', 20, true
    ), (
      '${ids.manifestVariantAsset}', '${ids.manifestStore}', '${ids.manifestProduct}',
      '${ids.manifestVariant}', 'Blue printable', 10, true
    );
    insert into public.digital_product_asset_versions(
      id, asset_id, version_number, storage_path, customer_filename, mime_type,
      byte_size, checksum_sha256, status
    ) values (
      '${ids.manifestProductWideV1}', '${ids.manifestProductWideAsset}', 1,
      '${ids.manifestStore}/${ids.manifestProduct}/${ids.manifestProductWideAsset}/v1/instructions.pdf',
      'instructions.pdf', 'application/pdf', 100, repeat('1', 64), 'ready'
    ), (
      '${ids.manifestProductWideV2}', '${ids.manifestProductWideAsset}', 2,
      '${ids.manifestStore}/${ids.manifestProduct}/${ids.manifestProductWideAsset}/v2/instructions.pdf',
      'instructions.pdf', 'application/pdf', 200, repeat('2', 64), 'ready'
    ), (
      '${ids.manifestVariantV1}', '${ids.manifestVariantAsset}', 1,
      '${ids.manifestStore}/${ids.manifestProduct}/${ids.manifestVariantAsset}/v1/blue.zip',
      'blue-printable.zip', 'application/zip', 300, repeat('3', 64), 'ready'
    );
    insert into public.digital_product_previews(
      product_id, source_asset_version_id, public_preview_path, status
    ) values (
      '${ids.manifestProduct}', '${ids.manifestVariantV1}',
      '${ids.manifestStore}/${ids.manifestProduct}/preview.jpg', 'ready'
    );
    update public.products set status = 'active' where id = '${ids.manifestProduct}';
    insert into public.storefront_checkout_sessions(
      id, store_id, store_slug, customer_email, items, checkout_composition, status,
      digital_consent_version, digital_consent_accepted_at, digital_license_version
    ) values (
      '${ids.manifestCheckout}', '${ids.manifestStore}', 'manifest-store',
      'buyer@example.test',
      jsonb_build_array(
        jsonb_build_object('productId', '${ids.manifestProduct}', 'variantId', '${ids.manifestVariant}', 'quantity', 1, 'productType', 'digital'),
        jsonb_build_object('productId', '${ids.manifestPhysicalProduct}', 'variantId', '${ids.manifestPhysicalVariant}', 'quantity', 1, 'productType', 'physical')
      ),
      'mixed', 'pending', 'immediate-delivery-v1', '2026-08-13T04:00:00Z', 'personal-use-v1'
    ), (
      '${ids.manifestConcurrentCheckout}', '${ids.manifestStore}', 'manifest-store',
      'buyer@example.test',
      jsonb_build_array(
        jsonb_build_object('productId', '${ids.manifestProduct}', 'variantId', '${ids.manifestVariant}', 'quantity', 1, 'productType', 'digital')
      ),
      'digital_only', 'pending', 'immediate-delivery-v1', '2026-08-13T04:01:00Z', 'personal-use-v1'
    );`,
  );
}, 60_000);

afterAll(() => {
  if (pgCtl && clusterDirectory) {
    execFileSync(pgCtl, ["-D", clusterDirectory, "-m", "fast", "-w", "stop"], {
      stdio: "ignore",
    });
    rmSync(clusterDirectory, { recursive: true, force: true });
  }
});

describe("digital product migration upgrade safety", () => {
  it("preserves valid prototype data while backfilling relational keys", () => {
    expect(
      runSql(
        "upgrade",
        `select store_id from public.order_items where id = '${ids.itemA}'`,
      ),
    ).toBe(ids.storeA);
    expect(
      runSql(
        "upgrade",
        `select store_id || ':' || product_id from public.digital_product_asset_versions where id = '${ids.versionA}'`,
      ),
    ).toBe(`${ids.storeA}:${ids.productA}`);
    expect(
      runSql(
        "upgrade",
        `select status || ':' || (issued_at is not null)::text from public.digital_download_grants where id = '${ids.legacyGrant}'`,
      ),
    ).toBe("issued:true");
  });

  it("applies after the prototype migration on an empty fresh schema", () => {
    expect(
      runSql(
        "fresh",
        "select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('digital_purchase_manifests', 'digital_purchase_manifest_items', 'digital_delivery_jobs', 'digital_delivery_attempts')",
      ),
    ).toBe("4");
  });

  it("replays the complete repository migration chain", () => {
    expect(
      runSql(
        "full_chain",
        "select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('digital_purchase_manifests', 'digital_purchase_manifest_items', 'digital_delivery_jobs', 'digital_delivery_attempts')",
      ),
    ).toBe("4");
  });
});

describe("digital product relational integrity", () => {
  it("derives new relational keys for legacy insert shapes", () => {
    expect(
      runSql(
        "upgrade",
        `insert into public.order_items(id, order_id, product_id, product_variant_id)
         values (
           '50000000-0000-0000-0000-000000000004', '${ids.orderA2}',
           '${ids.productA2}', '${ids.variantA2}'
         ) returning store_id`,
      ),
    ).toBe(ids.storeA);
    expect(
      runSql(
        "upgrade",
        `insert into public.digital_product_asset_versions(
           id, asset_id, version_number, storage_path, customer_filename,
           mime_type, byte_size, checksum_sha256, status
         ) values (
           '70000000-0000-0000-0000-000000000006', '${ids.assetA2}', 2,
           'private/a2-v2', 'a2-v2.pdf', 'application/pdf', 10,
           repeat('2', 64), 'ready'
         ) returning store_id || ':' || product_id`,
      ),
    ).toBe(`${ids.storeA}:${ids.productA2}`);
    expect(
      runSql(
        "upgrade",
        `insert into public.digital_product_previews(
           product_id, source_asset_version_id, public_preview_path, status
         ) values (
           '${ids.productA2}', '70000000-0000-0000-0000-000000000006',
           'public/a2.jpg', 'ready'
         ) returning store_id || ':' || source_asset_id`,
      ),
    ).toBe(`${ids.storeA}:${ids.assetA2}`);
  });

  it("rejects ready previews without a public path", () => {
    expectRejected(
      "upgrade",
      `insert into public.digital_product_previews(product_id, status)
       values ('${ids.productB}', 'ready')`,
    );
  });

  it("rejects a product from another store", () => {
    expectRejected(
      "upgrade",
      `insert into public.digital_product_assets(store_id, product_id, label)
       values ('${ids.storeB}', '${ids.productA}', 'Cross tenant')`,
    );
  });

  it("rejects a variant that belongs to another product", () => {
    expectRejected(
      "upgrade",
      `insert into public.digital_product_assets(store_id, product_id, product_variant_id, label)
       values ('${ids.storeA}', '${ids.productA}', '${ids.variantA2}', 'Wrong variant')`,
    );
  });

  it("rejects a version that does not belong to the selected asset", () => {
    runSql(
      "upgrade",
      `insert into public.digital_purchase_manifests(id, store_id, order_id, consent_version, license_version)
       values ('${ids.manifestA}', '${ids.storeA}', '${ids.orderA}', 'immediate-delivery-v1', 'personal-use-v1')`,
    );

    expectRejected(
      "upgrade",
      `insert into public.digital_purchase_manifest_items(
        manifest_id, store_id, order_id, order_item_id, product_id, product_variant_id,
        asset_id, asset_version_id, customer_filename, mime_type, byte_size,
        checksum_sha256, label, sort_order
      ) values (
        '${ids.manifestA}', '${ids.storeA}', '${ids.orderA}', '${ids.itemA}',
        '${ids.productA}', '${ids.variantA}', '${ids.assetA}', '${ids.versionA2}',
        'a.pdf', 'application/pdf', 10, repeat('a', 64), 'File A', 0
      )`,
    );
  });

  it("rejects manifest items that mix a manifest order with another order", () => {
    expectRejected(
      "upgrade",
      `insert into public.digital_purchase_manifest_items(
        manifest_id, store_id, order_id, order_item_id, product_id, product_variant_id,
        asset_id, asset_version_id, customer_filename, mime_type, byte_size,
        checksum_sha256, label, sort_order
      ) values (
        '${ids.manifestA}', '${ids.storeA}', '${ids.orderA2}', '${ids.itemA2}',
        '${ids.productA2}', '${ids.variantA2}', '${ids.assetA2}', '${ids.versionA2}',
        'a2.pdf', 'application/pdf', 10, repeat('b', 64), 'File A2', 0
      )`,
    );
  });

  it("rejects manifest items that mix a product with another product's asset", () => {
    expectRejected(
      "upgrade",
      `insert into public.digital_purchase_manifest_items(
        manifest_id, store_id, order_id, order_item_id, product_id, product_variant_id,
        asset_id, asset_version_id, customer_filename, mime_type, byte_size,
        checksum_sha256, label, sort_order
      ) values (
        '${ids.manifestA}', '${ids.storeA}', '${ids.orderA}', '${ids.itemA}',
        '${ids.productA}', '${ids.variantA}', '${ids.assetA2}', '${ids.versionA2}',
        'a2.pdf', 'application/pdf', 10, repeat('b', 64), 'File A2', 0
      )`,
    );
  });
});

describe("transactional checkout manifests", () => {
  const mixedItemsSql = `jsonb_build_array(
    jsonb_build_object(
      'productId', '${ids.manifestProduct}',
      'variantId', '${ids.manifestVariant}',
      'quantity', 1,
      'productType', 'digital'
    ),
    jsonb_build_object(
      'productId', '${ids.manifestPhysicalProduct}',
      'variantId', '${ids.manifestPhysicalVariant}',
      'quantity', 1,
      'productType', 'physical'
    )
  )`;
  const digitalItemsSql = `jsonb_build_array(
    jsonb_build_object(
      'productId', '${ids.manifestProduct}',
      'variantId', '${ids.manifestVariant}',
      'quantity', 1,
      'productType', 'digital'
    )
  )`;

  function createManifest(checkoutSessionId = ids.manifestCheckout, itemsSql = mixedItemsSql) {
    return JSON.parse(
      runSql(
        "full_chain",
        `select public.create_or_reuse_digital_checkout_manifest(
          '${checkoutSessionId}', '${ids.manifestStore}', ${itemsSql},
          'immediate-delivery-v1',
          case when '${checkoutSessionId}' = '${ids.manifestConcurrentCheckout}'
            then '2026-08-13T04:01:00Z'::timestamptz
            else '2026-08-13T04:00:00Z'::timestamptz
          end,
          'personal-use-v1'
        )`,
      ),
    ) as {
      manifestId: string;
      orderId: string | null;
      checkoutSessionId: string;
      storeId: string;
      consentVersion: string;
      licenseVersion: string;
      createdAt: string;
      items: Array<Record<string, unknown>>;
    };
  }

  it("captures product-wide and selected-variant files in deterministic order using newest ready versions", () => {
    const manifest = createManifest();

    expect(manifest).toMatchObject({
      orderId: null,
      checkoutSessionId: ids.manifestCheckout,
      storeId: ids.manifestStore,
      consentVersion: "immediate-delivery-v1",
      licenseVersion: "personal-use-v1",
    });
    expect(manifest.items).toEqual([
      {
        orderItemId: null,
        productId: ids.manifestProduct,
        productVariantId: ids.manifestVariant,
        assetId: ids.manifestVariantAsset,
        assetVersionId: ids.manifestVariantV1,
        customerFilename: "blue-printable.zip",
        mimeType: "application/zip",
        byteSize: 300,
        checksumSha256: "3".repeat(64),
        label: "Blue printable",
        sortOrder: 0,
      },
      {
        orderItemId: null,
        productId: ids.manifestProduct,
        productVariantId: ids.manifestVariant,
        assetId: ids.manifestProductWideAsset,
        assetVersionId: ids.manifestProductWideV2,
        customerFilename: "instructions.pdf",
        mimeType: "application/pdf",
        byteSize: 200,
        checksumSha256: "2".repeat(64),
        label: "Instructions",
        sortOrder: 1,
      },
    ]);
    expect(JSON.stringify(manifest)).not.toContain(ids.manifestStore + "/");
    expect(
      runSql(
        "full_chain",
        `select digital_manifest_id::text from public.storefront_checkout_sessions
         where id = '${ids.manifestCheckout}'`,
      ),
    ).toBe(manifest.manifestId);
    expect(
      runSql(
        "full_chain",
        `select request_fingerprint_sha256 from public.digital_purchase_manifests
         where id = '${manifest.manifestId}'`,
      ),
    ).toMatch(/^[a-f0-9]{64}$/);
  });

  it("reuses the identical snapshot after a newer catalog version appears", () => {
    const original = createManifest();
    runSql(
      "full_chain",
      `insert into public.digital_product_asset_versions(
        id, asset_id, version_number, storage_path, customer_filename, mime_type,
        byte_size, checksum_sha256, status
      ) values (
        '71000000-0000-4000-8000-000000000004',
        '${ids.manifestProductWideAsset}', 3,
        '${ids.manifestStore}/${ids.manifestProduct}/${ids.manifestProductWideAsset}/v3/instructions.pdf',
        'instructions-v3.pdf', 'application/pdf', 400, repeat('4', 64), 'ready'
      ) on conflict (id) do nothing`,
    );

    const retried = createManifest();
    expect(retried).toEqual(original);
    expect(retried.items.map((item) => item.assetVersionId)).toContain(
      ids.manifestProductWideV2,
    );
    expect(retried.items.map((item) => item.assetVersionId)).not.toContain(
      "72000000-0000-4000-8000-000000000004",
    );
  });

  it("rejects reuse when the checkout fingerprint does not match", () => {
    createManifest();
    expectRejected(
      "full_chain",
      `select public.create_or_reuse_digital_checkout_manifest(
        '${ids.manifestCheckout}', '${ids.manifestStore}', ${digitalItemsSql},
        'immediate-delivery-v1', '2026-08-13T04:00:00Z', 'personal-use-v1'
      )`,
    );
    expect(
      runSql(
        "full_chain",
        `select count(*) from public.digital_purchase_manifests
         where checkout_session_id = '${ids.manifestCheckout}'`,
      ),
    ).toBe("1");
  });

  it("serializes concurrent retries to one identical manifest", async () => {
    const statement = `select public.create_or_reuse_digital_checkout_manifest(
      '${ids.manifestConcurrentCheckout}', '${ids.manifestStore}', ${digitalItemsSql},
      'immediate-delivery-v1', '2026-08-13T04:01:00Z', 'personal-use-v1'
    )`;
    const [first, second] = await Promise.all([
      runSqlAsync("full_chain", statement, "manifest-create-a"),
      runSqlAsync("full_chain", statement, "manifest-create-b"),
    ]);

    expect(JSON.parse(first)).toEqual(JSON.parse(second));
    expect(
      runSql(
        "full_chain",
        `select count(*) from public.digital_purchase_manifests
         where checkout_session_id = '${ids.manifestConcurrentCheckout}'`,
      ),
    ).toBe("1");
  });

  it("rejects a digital selection without a ready preview or deliverable", () => {
    const unreadyProduct = "22000000-0000-4000-8000-000000000010";
    const unreadyVariant = "32000000-0000-4000-8000-000000000010";
    const unreadyCheckout = "42000000-0000-4000-8000-000000000010";
    runSql(
      "full_chain",
      `insert into public.products(
        id, store_id, title, description, price_cents, inventory_qty, status,
        product_type, digital_rights_affirmed_at, digital_rights_affirmed_by_user_id
      ) values (
        '${unreadyProduct}', '${ids.manifestStore}', 'Unready', '', 1000, 1,
        'draft', 'digital', now(), '00000000-0000-4000-8000-000000000011'
      ) on conflict (id) do nothing;
      insert into public.product_variants(
        id, store_id, product_id, price_cents, inventory_qty, is_default, status
      ) values (
        '${unreadyVariant}', '${ids.manifestStore}', '${unreadyProduct}',
        1000, 1, true, 'active'
      ) on conflict (id) do nothing;
      insert into public.storefront_checkout_sessions(
        id, store_id, store_slug, customer_email, items, checkout_composition, status,
        digital_consent_version, digital_consent_accepted_at, digital_license_version
      ) values (
        '${unreadyCheckout}', '${ids.manifestStore}', 'manifest-store',
        'buyer@example.test',
        jsonb_build_array(jsonb_build_object(
          'productId', '${unreadyProduct}', 'variantId', '${unreadyVariant}', 'quantity', 1,
          'productType', 'digital'
        )),
        'digital_only', 'pending', 'immediate-delivery-v1', now(), 'personal-use-v1'
      ) on conflict (id) do nothing`,
    );

    expectRejected(
      "full_chain",
      `select public.create_or_reuse_digital_checkout_manifest(
        '${unreadyCheckout}', '${ids.manifestStore}',
        jsonb_build_array(jsonb_build_object(
          'productId', '${unreadyProduct}', 'variantId', '${unreadyVariant}', 'quantity', 1
        )),
        'immediate-delivery-v1',
        (select digital_consent_accepted_at from public.storefront_checkout_sessions where id = '${unreadyCheckout}'),
        'personal-use-v1'
      )`,
    );
    expect(
      runSql(
        "full_chain",
        `select count(*) from public.digital_purchase_manifests
         where checkout_session_id = '${unreadyCheckout}'`,
      ),
    ).toBe("0");
  });

  it("rolls stub order creation back when manifest locking fails, then retries cleanly", () => {
    const checkoutId = "42000000-0000-4000-8000-000000000020";
    const paymentRef = "stub_pi_manifest_atomicity";
    const checkoutItemsSql = `jsonb_build_array(jsonb_build_object(
      'productId', '${ids.manifestProduct}',
      'variantId', '${ids.manifestVariant}',
      'quantity', 1,
      'variantLabel', 'Blue',
      'productTitle', 'Digital set',
      'productType', 'digital',
      'unitPriceCents', 2500
    ))`;
    runSql(
      "full_chain",
      `insert into public.storefront_checkout_sessions(
        id, store_id, store_slug, customer_email, items, checkout_composition, status,
        digital_consent_version, digital_consent_accepted_at, digital_license_version
      ) values (
        '${checkoutId}', '${ids.manifestStore}', 'manifest-store',
        'buyer@example.test', ${checkoutItemsSql}, 'digital_only', 'pending',
        'immediate-delivery-v1', '2026-08-13T04:02:00Z', 'personal-use-v1'
      )`,
    );
    const manifest = JSON.parse(
      runSql(
        "full_chain",
        `select public.create_or_reuse_digital_checkout_manifest(
          '${checkoutId}', '${ids.manifestStore}', ${checkoutItemsSql},
          'immediate-delivery-v1', '2026-08-13T04:02:00Z', 'personal-use-v1'
        )`,
      ),
    ) as { manifestId: string };
    const inventoryBefore = runSql(
      "full_chain",
      `select inventory_qty from public.product_variants where id = '${ids.manifestVariant}'`,
    );

    runSql(
      "full_chain",
      `create function public.test_reject_manifest_lock()
       returns trigger language plpgsql as $$
       begin
         if new.status = 'locked' then
           raise exception 'Injected manifest lock failure';
         end if;
         return new;
       end;
       $$;
       create trigger test_reject_manifest_lock
       before update of status on public.digital_purchase_manifests
       for each row execute function public.test_reject_manifest_lock()`,
    );

    expectRejected(
      "full_chain",
      `select * from public.stub_checkout_create_paid_order_with_manifest(
        'manifest-store', 'buyer@example.test', null, ${checkoutItemsSql},
        '${paymentRef}', 0, null, '${checkoutId}', '${manifest.manifestId}'
      )`,
    );
    expect(
      runSql(
        "full_chain",
        `select count(*) from public.orders where stripe_payment_intent_id = '${paymentRef}'`,
      ),
    ).toBe("0");
    expect(
      runSql(
        "full_chain",
        `select status || ':' || (order_id is null)::text
         from public.digital_purchase_manifests where id = '${manifest.manifestId}'`,
      ),
    ).toBe("draft:true");
    expect(
      runSql(
        "full_chain",
        `select inventory_qty from public.product_variants where id = '${ids.manifestVariant}'`,
      ),
    ).toBe(inventoryBefore);

    runSql(
      "full_chain",
      `drop trigger test_reject_manifest_lock on public.digital_purchase_manifests;
       drop function public.test_reject_manifest_lock()`,
    );
    const orderId = runSql(
      "full_chain",
      `select order_id from public.stub_checkout_create_paid_order_with_manifest(
        'manifest-store', 'buyer@example.test', null, ${checkoutItemsSql},
        '${paymentRef}', 0, null, '${checkoutId}', '${manifest.manifestId}'
      )`,
    );

    expect(orderId).toMatch(/^[a-f0-9-]{36}$/);
    expect(
      runSql(
        "full_chain",
        `select status || ':' || order_id::text
         from public.digital_purchase_manifests where id = '${manifest.manifestId}'`,
      ),
    ).toBe(`locked:${orderId}`);
    expect(
      runSql(
        "full_chain",
        `select status || ':' || order_id::text
         from public.storefront_checkout_sessions where id = '${checkoutId}'`,
      ),
    ).toBe(`completed:${orderId}`);
  });

  it("locks once to the exact order items and rejects later mutation", () => {
    const manifest = createManifest();
    runSql(
      "full_chain",
      `insert into public.orders(
        id, store_id, customer_email, subtotal_cents, total_cents, status
      ) values (
        '${ids.manifestOrder}', '${ids.manifestStore}', 'buyer@example.test', 4000, 4000, 'paid'
      ) on conflict (id) do nothing;
      insert into public.order_items(
        id, order_id, product_id, product_variant_id, quantity, unit_price_cents, product_type
      ) values (
        '${ids.manifestOrderItem}', '${ids.manifestOrder}', '${ids.manifestProduct}',
        '${ids.manifestVariant}', 1, 2500, 'digital'
      ), (
        '${ids.manifestPhysicalOrderItem}', '${ids.manifestOrder}', '${ids.manifestPhysicalProduct}',
        '${ids.manifestPhysicalVariant}', 1, 1500, 'physical'
      ) on conflict (id) do nothing`,
    );

    const locked = JSON.parse(
      runSql(
        "full_chain",
        `select public.lock_digital_checkout_manifest(
          '${manifest.manifestId}', '${ids.manifestOrder}'
        )`,
      ),
    ) as { orderId: string; items: Array<{ orderItemId: string }> };
    const retried = JSON.parse(
      runSql(
        "full_chain",
        `select public.lock_digital_checkout_manifest(
          '${manifest.manifestId}', '${ids.manifestOrder}'
        )`,
      ),
    );

    expect(locked.orderId).toBe(ids.manifestOrder);
    expect(locked.items.every((item) => item.orderItemId === ids.manifestOrderItem)).toBe(true);
    expect(retried).toEqual(locked);
    expectRejected(
      "full_chain",
      `update public.digital_purchase_manifest_items
       set customer_filename = 'changed.pdf'
       where manifest_id = '${manifest.manifestId}'`,
    );
  });

  it("keeps manifest and stub wrapper functions service-role-only", () => {
    expect(
      runSql(
        "full_chain",
        `select
          has_function_privilege('anon', 'public.create_or_reuse_digital_checkout_manifest(uuid,uuid,jsonb,text,timestamp with time zone,text)', 'execute')::text || ':' ||
          has_function_privilege('authenticated', 'public.lock_digital_checkout_manifest(uuid,uuid)', 'execute')::text || ':' ||
          has_function_privilege('service_role', 'public.create_or_reuse_digital_checkout_manifest(uuid,uuid,jsonb,text,timestamp with time zone,text)', 'execute')::text || ':' ||
          has_function_privilege('service_role', 'public.stub_checkout_create_paid_order_with_manifest(text,text,uuid,jsonb,text,integer,text,uuid,uuid)', 'execute')::text`,
      ),
    ).toBe("false:false:true:true");
  });
});

describe("durable digital delivery", () => {
  const deliveryItemsSql = `jsonb_build_array(jsonb_build_object(
    'productId', '${ids.manifestProduct}',
    'variantId', '${ids.manifestVariant}',
    'quantity', 1,
    'variantLabel', 'Blue',
    'productTitle', 'Digital set',
    'productType', 'digital',
    'unitPriceCents', 2500
  ))`;

  function retireClaimableJobs() {
    runSql(
      "full_chain",
      `update public.digital_delivery_attempts
       set status = 'failed', safe_error = 'Test isolation', finished_at = now()
       where status = 'processing';
       update public.digital_delivery_jobs
       set status = 'failed', lease_expires_at = null, lease_token = null,
           last_safe_error = 'Test isolation', completed_at = now(), updated_at = now()
       where status in ('pending', 'processing')`,
    );
  }

  function prepareDeliveryCheckout(suffix: string) {
    const checkoutId = `42000000-0000-4000-8000-${suffix}`;
    runSql(
      "full_chain",
      `update public.products set status = 'active' where id = '${ids.manifestProduct}';
       update public.product_variants set status = 'active' where id = '${ids.manifestVariant}';
       insert into public.storefront_checkout_sessions(
         id, store_id, store_slug, customer_email, customer_first_name,
         customer_last_name, items, checkout_composition, fulfillment_method,
         fulfillment_label, shipping_fee_cents, promo_codes_json,
         applied_promotions_json, fee_plan_key, fee_bps, fee_fixed_cents,
         item_total_cents, platform_fee_cents, checkout_mode,
         tax_collection_mode_snapshot, status, digital_consent_version,
         digital_consent_accepted_at, digital_license_version
       ) values (
         '${checkoutId}', '${ids.manifestStore}', 'manifest-store',
         'delivery-${suffix}@example.test', 'Digital', 'Buyer',
         ${deliveryItemsSql}, 'digital_only', 'digital_delivery',
         'Digital delivery', 0, '[]'::jsonb, '[]'::jsonb, 'standard',
         600, 30, 2500, 180, 'stub', 'seller_attested_no_tax', 'pending',
         '${DIGITAL_PRODUCT_CONFIG.consentVersion}', now(),
         '${DIGITAL_PRODUCT_CONFIG.licenseVersion}'
       )`,
    );
    const manifestId = runSql(
      "full_chain",
      `select result ->> 'manifestId'
       from (
         select public.create_or_reuse_digital_checkout_manifest(
           '${checkoutId}', '${ids.manifestStore}', ${deliveryItemsSql},
           '${DIGITAL_PRODUCT_CONFIG.consentVersion}',
           (select digital_consent_accepted_at from public.storefront_checkout_sessions where id = '${checkoutId}'),
           '${DIGITAL_PRODUCT_CONFIG.licenseVersion}'
         ) result
       ) manifest`,
    );
    return { checkoutId, manifestId };
  }

  function finalizeDeliveryCheckout(suffix: string) {
    const prepared = prepareDeliveryCheckout(suffix);
    const paymentRef = `stub_pi_delivery_${suffix}`;
    const orderId = runSql(
      "full_chain",
      `select order_id from public.stub_checkout_create_paid_order_with_manifest(
        'manifest-store', 'ignored@example.test', null, '[]'::jsonb,
        '${paymentRef}', 0, null, '${prepared.checkoutId}', '${prepared.manifestId}'
      )`,
    );
    const jobId = runSql(
      "full_chain",
      `select id from public.digital_delivery_jobs
       where order_id = '${orderId}' and job_type = 'purchase_delivery'`,
    );
    return { ...prepared, orderId, jobId, paymentRef };
  }

  function claimDelivery(leaseSeconds = 120, maxAttempts = 8) {
    return JSON.parse(
      runSql(
        "full_chain",
        `select row_to_json(claim) from public.claim_digital_delivery_job(
          ${leaseSeconds}, ${maxAttempts}
        ) claim`,
      ),
    ) as {
      id: string;
      order_id: string;
      manifest_id: string;
      lease_token: string;
      attempt_number: number;
      notification_sent_at: string | null;
    };
  }

  function materializeStatement(job: ReturnType<typeof claimDelivery>) {
    return `select public.materialize_digital_delivery_from_manifest(
      '${job.id}', '${job.lease_token}',
      '70000000-0000-4000-8000-000000000071', repeat('a', 64),
      172800, ${DIGITAL_PRODUCT_CONFIG.grantsPerFile}
    )`;
  }

  it("rolls the paid order back when its durable job cannot be inserted", () => {
    retireClaimableJobs();
    const fixture = prepareDeliveryCheckout("000000000071");
    runSql(
      "full_chain",
      `create function public.test_reject_delivery_enqueue()
       returns trigger language plpgsql as $$
       begin
         raise exception 'Injected delivery enqueue failure';
       end;
       $$;
       create trigger test_reject_delivery_enqueue
       before insert on public.digital_delivery_jobs
       for each row execute function public.test_reject_delivery_enqueue()`,
    );

    try {
      expectRejected(
        "full_chain",
        `select * from public.stub_checkout_create_paid_order_with_manifest(
          'manifest-store', 'ignored@example.test', null, '[]'::jsonb,
          'stub_pi_delivery_atomic', 0, null,
          '${fixture.checkoutId}', '${fixture.manifestId}'
        )`,
      );
      expect(
        runSql(
          "full_chain",
          "select count(*) from public.orders where stripe_payment_intent_id = 'stub_pi_delivery_atomic'",
        ),
      ).toBe("0");
      expect(
        runSql(
          "full_chain",
          `select status from public.digital_purchase_manifests where id = '${fixture.manifestId}'`,
        ),
      ).toBe("draft");
    } finally {
      runSql(
        "full_chain",
        `drop trigger if exists test_reject_delivery_enqueue on public.digital_delivery_jobs;
         drop function if exists public.test_reject_delivery_enqueue()`,
      );
    }

    const orderId = runSql(
      "full_chain",
      `select order_id from public.stub_checkout_create_paid_order_with_manifest(
        'manifest-store', 'ignored@example.test', null, '[]'::jsonb,
        'stub_pi_delivery_atomic', 0, null,
        '${fixture.checkoutId}', '${fixture.manifestId}'
      )`,
    );
    runSql(
      "full_chain",
      `select public.enqueue_digital_delivery('${orderId}', '${fixture.manifestId}');
       select public.enqueue_digital_delivery('${orderId}', '${fixture.manifestId}')`,
    );
    expect(
      runSql(
        "full_chain",
        `select count(*) from public.digital_delivery_jobs where order_id = '${orderId}'`,
      ),
    ).toBe("1");
  });

  it("atomically gives one worker the lease under concurrent claims", async () => {
    retireClaimableJobs();
    const fixture = finalizeDeliveryCheckout("000000000072");
    const statement = `select row_to_json(claim) from public.claim_digital_delivery_job(120, 8) claim`;
    const [first, second] = await Promise.all([
      runSqlAsync("full_chain", statement, "delivery-claim-a"),
      runSqlAsync("full_chain", statement, "delivery-claim-b"),
    ]);
    const claimed = [first, second].filter(Boolean).map((value) => JSON.parse(value));

    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({
      id: fixture.jobId,
      order_id: fixture.orderId,
      manifest_id: fixture.manifestId,
      attempt_number: 1,
    });
    expect(claimed[0].lease_token).toMatch(/^[a-f0-9-]{36}$/);
    expect(
      runSql(
        "full_chain",
        `select count(*) from public.digital_delivery_attempts
         where job_id = '${fixture.jobId}' and status = 'processing'`,
      ),
    ).toBe("1");
  });

  it("rolls back after entitlement row one and concurrent retries converge to the manifest and one token", async () => {
    retireClaimableJobs();
    const fixture = finalizeDeliveryCheckout("000000000073");
    runSql(
      "full_chain",
      `insert into public.digital_product_asset_versions(
        id, asset_id, version_number, storage_path, customer_filename,
        mime_type, byte_size, checksum_sha256, status
      ) values (
        '71000000-0000-4000-8000-000000000073',
        '${ids.manifestProductWideAsset}', 4,
        '${ids.manifestStore}/${ids.manifestProduct}/${ids.manifestProductWideAsset}/v4/current.pdf',
        'current-catalog.pdf', 'application/pdf', 500, repeat('7', 64), 'ready'
      )`,
    );
    const job = claimDelivery();
    expect(job.id).toBe(fixture.jobId);

    runSql(
      "full_chain",
      `create function public.test_reject_second_entitlement()
       returns trigger language plpgsql as $$
       begin
         if new.asset_id = '${ids.manifestProductWideAsset}' then
           raise exception 'Injected entitlement row two failure';
         end if;
         return new;
       end;
       $$;
       create trigger test_reject_second_entitlement
       before insert on public.digital_order_entitlements
       for each row execute function public.test_reject_second_entitlement()`,
    );
    try {
      expectRejected("full_chain", materializeStatement(job));
      expect(
        runSql(
          "full_chain",
          `select count(*) from public.digital_order_entitlements where order_id = '${fixture.orderId}'`,
        ),
      ).toBe("0");
      expect(
        runSql(
          "full_chain",
          `select count(*) from public.digital_order_access_tokens where order_id = '${fixture.orderId}'`,
        ),
      ).toBe("0");
    } finally {
      runSql(
        "full_chain",
        `drop trigger if exists test_reject_second_entitlement on public.digital_order_entitlements;
         drop function if exists public.test_reject_second_entitlement()`,
      );
    }

    const statement = materializeStatement(job);
    const [first, second] = await Promise.all([
      runSqlAsync("full_chain", statement, "delivery-materialize-a"),
      runSqlAsync("full_chain", statement, "delivery-materialize-b"),
    ]);
    expect(JSON.parse(first)).toEqual(JSON.parse(second));
    expect(JSON.parse(first)).toMatchObject({ entitlement_count: 2 });
    expect(
      runSql(
        "full_chain",
        `select string_agg(customer_filename, ',' order by customer_filename)
         from public.digital_order_entitlements where order_id = '${fixture.orderId}'`,
      ),
    ).toBe("blue-printable.zip,instructions-v3.pdf");
    expect(
      runSql(
        "full_chain",
        `select count(*) from public.digital_order_access_tokens
         where order_id = '${fixture.orderId}' and issuance_reason = 'purchase'
           and revoked_at is null`,
      ),
    ).toBe("1");
    expect(
      runSql(
        "full_chain",
        `select extract(epoch from expires_at - created_at)::integer
         from public.digital_order_access_tokens
         where order_id = '${fixture.orderId}' and issuance_reason = 'purchase'
           and revoked_at is null`,
      ),
    ).toBe("172800");

    runSql(
      "full_chain",
      `select public.mark_digital_delivery_notification_sent('${job.id}', '${job.lease_token}');
       select public.complete_digital_delivery_job(
         '${job.id}', '${job.lease_token}', 'succeeded', null, 8, 60, 21600
       )`,
    );
    expect(
      runSql(
        "full_chain",
        `select status || ':' || (notification_sent_at is not null)::text
         from public.digital_delivery_jobs where id = '${job.id}'`,
      ),
    ).toBe("succeeded:true");
  });

  it("treats entitlements outside the locked manifest as an operational mismatch", () => {
    retireClaimableJobs();
    const fixture = finalizeDeliveryCheckout("000000000074");
    const job = claimDelivery();
    const orderItemId = runSql(
      "full_chain",
      `select id from public.order_items where order_id = '${fixture.orderId}'`,
    );
    runSql(
      "full_chain",
      `insert into public.digital_order_entitlements(
        store_id, order_id, order_item_id, product_id, product_variant_id,
        asset_id, asset_version_id, customer_filename, mime_type, byte_size,
        license_version, max_download_grants
      ) values (
        '${ids.manifestStore}', '${fixture.orderId}', '${orderItemId}',
        '${ids.manifestProduct}', '${ids.manifestVariant}',
        '${ids.manifestProductWideAsset}', '${ids.manifestProductWideV1}',
        'legacy-catalog-file.pdf', 'application/pdf', 100,
        '${DIGITAL_PRODUCT_CONFIG.licenseVersion}', ${DIGITAL_PRODUCT_CONFIG.grantsPerFile}
      )`,
    );

    expectRejected("full_chain", materializeStatement(job));
    expect(
      runSql(
        "full_chain",
        `select count(*) from public.digital_order_entitlements where order_id = '${fixture.orderId}'`,
      ),
    ).toBe("1");
    expect(
      runSql(
        "full_chain",
        `select count(*) from public.digital_order_access_tokens where order_id = '${fixture.orderId}'`,
      ),
    ).toBe("0");
  });

  it("recovers stale leases with exponential backoff and dead-letters at the bound", async () => {
    retireClaimableJobs();
    const fixture = finalizeDeliveryCheckout("000000000075");
    const first = claimDelivery(1, 3);
    expect(first.id).toBe(fixture.jobId);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_100));
    const second = claimDelivery(120, 3);
    expect(second).toMatchObject({ id: fixture.jobId, attempt_number: 2 });
    expect(
      runSql(
        "full_chain",
        `select status || ':' || safe_error from public.digital_delivery_attempts
         where job_id = '${fixture.jobId}' and attempt_number = 1`,
      ),
    ).toBe("failed:Processing lease expired");

    const retry = JSON.parse(
      runSql(
        "full_chain",
        `select public.complete_digital_delivery_job(
          '${second.id}', '${second.lease_token}', 'failed',
          'Authorization: Bearer secret buyer@example.test https://myrivo.test/downloads/raw',
          3, 10, 30
        )`,
      ),
    ) as { status: string; next_attempt_at: string };
    expect(retry.status).toBe("pending");
    expect(new Date(retry.next_attempt_at).getTime()).toBeGreaterThan(
      Date.now() + 18_000,
    );
    expect(
      runSql(
        "full_chain",
        `select last_safe_error from public.digital_delivery_jobs where id = '${fixture.jobId}'`,
      ),
    ).toBe("Digital delivery attempt failed");

    runSql(
      "full_chain",
      `update public.digital_delivery_jobs set next_attempt_at = now() where id = '${fixture.jobId}'`,
    );
    const third = claimDelivery(120, 3);
    const terminal = JSON.parse(
      runSql(
        "full_chain",
        `select public.complete_digital_delivery_job(
          '${third.id}', '${third.lease_token}', 'failed', 'Provider unavailable',
          3, 10, 30
        )`,
      ),
    ) as { status: string; next_attempt_at: null };
    expect(terminal).toEqual({ status: "failed", next_attempt_at: null });
    expect(
      runSql(
        "full_chain",
        `select status || ':' || attempt_count::text || ':' || (completed_at is not null)::text
         from public.digital_delivery_jobs where id = '${fixture.jobId}'`,
      ),
    ).toBe("failed:3:true");
  });

  it("keeps every delivery mutation service-role-only while merchants can read failures", () => {
    expect(
      runSql(
        "full_chain",
        `select
          has_function_privilege('anon', 'public.claim_digital_delivery_job(integer,integer)', 'execute')::text || ':' ||
          has_function_privilege('authenticated', 'public.materialize_digital_delivery_from_manifest(uuid,uuid,uuid,text,integer,integer)', 'execute')::text || ':' ||
          has_function_privilege('service_role', 'public.enqueue_digital_delivery(uuid,uuid)', 'execute')::text || ':' ||
          has_function_privilege('service_role', 'public.complete_digital_delivery_job(uuid,uuid,text,text,integer,integer,integer)', 'execute')::text`,
      ),
    ).toBe("false:false:true:true");
  });
});

describe("checkout attempt recovery", () => {
  const checkoutJson = `jsonb_build_object(
    'store_slug', 'manifest-store',
    'customer_email', 'buyer@example.test',
    'customer_first_name', 'Retry',
    'customer_last_name', 'Buyer',
    'customer_phone', '',
    'customer_note', null,
    'fulfillment_method', 'shipping',
    'fulfillment_label', 'Shipping',
    'shipping_fee_cents', 0,
    'promo_code', null,
    'promo_codes_json', '[]'::jsonb,
    'applied_promotions_json', '[]'::jsonb,
    'fee_plan_key', 'standard',
    'fee_bps', 500,
    'fee_fixed_cents', 0,
    'item_total_cents', 2500,
    'platform_fee_cents', 125,
    'attribution_json', '{}'::jsonb,
    'items', jsonb_build_array(jsonb_build_object(
      'productId', '${ids.manifestProduct}',
      'variantId', '${ids.manifestVariant}',
      'quantity', 1,
      'variantLabel', 'Blue',
      'productTitle', 'Digital set',
      'productType', 'digital',
      'unitPriceCents', 2500
    )),
    'digital_consent_version', '${DIGITAL_PRODUCT_CONFIG.consentVersion}',
    'digital_consent_accepted_at', '2026-08-13T04:00:00Z',
    'digital_license_version', '${DIGITAL_PRODUCT_CONFIG.licenseVersion}',
    'checkout_mode', 'stub',
    'stripe_account_id_snapshot', null,
    'tax_collection_mode_snapshot', 'seller_attested_no_tax',
    'status', 'pending'
  )`;

  it("serializes concurrent double submits to one checkout row", async () => {
    const attemptKey = "018f6fc1-8adc-7f43-8000-000000000101";
    const fingerprint = "a".repeat(64);
    const statement = `select public.create_or_reuse_storefront_checkout_attempt(
      '${ids.manifestStore}', '${attemptKey}', '${fingerprint}', ${checkoutJson}
    )`;
    const [first, second] = await Promise.all([
      runSqlAsync("full_chain", statement, "checkout-attempt-a"),
      runSqlAsync("full_chain", statement, "checkout-attempt-b"),
    ]);
    const firstResult = JSON.parse(first) as { id: string };
    const secondResult = JSON.parse(second) as { id: string };

    expect(secondResult.id).toBe(firstResult.id);
    expect(
      runSql(
        "full_chain",
        `select count(*) from public.storefront_checkout_sessions
         where store_id = '${ids.manifestStore}' and checkout_attempt_key = '${attemptKey}'`,
      ),
    ).toBe("1");
  });

  it("rejects the same attempt key when the canonical request fingerprint changes", () => {
    const attemptKey = "018f6fc1-8adc-7f43-8000-000000000102";
    runSql(
      "full_chain",
      `select public.create_or_reuse_storefront_checkout_attempt(
        '${ids.manifestStore}', '${attemptKey}', '${"b".repeat(64)}', ${checkoutJson}
      )`,
    );

    expectRejected(
      "full_chain",
      `select public.create_or_reuse_storefront_checkout_attempt(
        '${ids.manifestStore}', '${attemptKey}', '${"c".repeat(64)}', ${checkoutJson}
      )`,
    );
    expect(
      runSql(
        "full_chain",
        `select count(*) from public.storefront_checkout_sessions
         where store_id = '${ids.manifestStore}' and checkout_attempt_key = '${attemptKey}'`,
      ),
    ).toBe("1");
  });

  it("binds one Stripe session idempotently and rejects replacement", () => {
    const attemptKey = "018f6fc1-8adc-7f43-8000-000000000103";
    const checkout = JSON.parse(
      runSql(
        "full_chain",
        `select public.create_or_reuse_storefront_checkout_attempt(
          '${ids.manifestStore}', '${attemptKey}', '${"d".repeat(64)}', ${checkoutJson}
        )`,
      ),
    ) as { id: string };
    const bind = `select public.bind_storefront_checkout_stripe_session(
      '${checkout.id}', '${ids.manifestStore}', 'cs_test_recoverable',
      'https://checkout.stripe.com/c/pay/cs_test_recoverable'
    )`;

    expect(JSON.parse(runSql("full_chain", bind))).toMatchObject({
      id: checkout.id,
      stripe_checkout_session_id: "cs_test_recoverable",
      stripe_checkout_url: "https://checkout.stripe.com/c/pay/cs_test_recoverable",
      status: "pending",
    });
    expect(JSON.parse(runSql("full_chain", bind))).toMatchObject({ id: checkout.id });
    expectRejected(
      "full_chain",
      `select public.bind_storefront_checkout_stripe_session(
        '${checkout.id}', '${ids.manifestStore}', 'cs_test_other',
        'https://checkout.stripe.com/c/pay/cs_test_other'
      )`,
    );
  });

  it("keeps attempt creation and Stripe binding service-role-only", () => {
    expect(
      runSql(
        "full_chain",
        `select
          has_function_privilege('anon', 'public.create_or_reuse_storefront_checkout_attempt(uuid,text,text,jsonb)', 'execute')::text || ':' ||
          has_function_privilege('authenticated', 'public.create_or_reuse_storefront_checkout_attempt(uuid,text,text,jsonb)', 'execute')::text || ':' ||
          has_function_privilege('service_role', 'public.create_or_reuse_storefront_checkout_attempt(uuid,text,text,jsonb)', 'execute')::text`,
      ),
    ).toBe("false:false:true");
    expect(
      runSql(
        "full_chain",
        `select
          has_function_privilege('anon', 'public.get_storefront_checkout_attempt(uuid,text,text)', 'execute')::text || ':' ||
          has_function_privilege('authenticated', 'public.get_storefront_checkout_attempt(uuid,text,text)', 'execute')::text || ':' ||
          has_function_privilege('service_role', 'public.get_storefront_checkout_attempt(uuid,text,text)', 'execute')::text`,
      ),
    ).toBe("false:false:true");
    expect(
      runSql(
        "full_chain",
        `select
          has_function_privilege('anon', 'public.bind_storefront_checkout_stripe_session(uuid,uuid,text,text)', 'execute')::text || ':' ||
          has_function_privilege('authenticated', 'public.bind_storefront_checkout_stripe_session(uuid,uuid,text,text)', 'execute')::text || ':' ||
          has_function_privilege('service_role', 'public.bind_storefront_checkout_stripe_session(uuid,uuid,text,text)', 'execute')::text`,
      ),
    ).toBe("false:false:true");
  });

  it("creates one stub order from the immutable checkout snapshot under concurrent retries", async () => {
    const attemptKey = "018f6fc1-8adc-7f43-8000-000000000104";
    const fingerprint = "e".repeat(64);
    const paymentRef = "stub_pi_018f6fc18adc7f438000000000000104";
    const checkout = JSON.parse(
      runSql(
        "full_chain",
        `select public.create_or_reuse_storefront_checkout_attempt(
          '${ids.manifestStore}', '${attemptKey}', '${fingerprint}',
          jsonb_build_object(
            'store_slug', 'manifest-store',
            'customer_email', 'snapshot@example.test',
            'customer_first_name', 'Snapshot',
            'customer_last_name', 'Buyer',
            'customer_phone', '555-0199',
            'customer_note', 'Persist this note',
            'fulfillment_method', 'shipping',
            'fulfillment_label', 'Archived shipping option',
            'shipping_fee_cents', 321,
            'promo_code', 'SNAPSHOT',
            'promo_codes_json', '["SNAPSHOT"]'::jsonb,
            'fee_plan_key', 'standard',
            'fee_bps', 777,
            'fee_fixed_cents', 12,
            'item_total_cents', 1234,
            'platform_fee_cents', 108,
            'attribution_json', '{}'::jsonb,
            'items', jsonb_build_array(jsonb_build_object(
              'productId', '${ids.manifestPhysicalProduct}',
              'variantId', '${ids.manifestPhysicalVariant}',
              'quantity', 1,
              'variantLabel', 'Snapshot oak',
              'productTitle', 'Snapshot frame',
              'productType', 'physical',
              'unitPriceCents', 1500
            )),
            'digital_consent_version', null,
            'digital_consent_accepted_at', null,
            'digital_license_version', null,
            'checkout_mode', 'stub',
            'stripe_account_id_snapshot', null,
            'tax_collection_mode_snapshot', 'seller_attested_no_tax',
            'applied_promotions_json', '[]'::jsonb,
            'status', 'pending'
          )
        )`,
      ),
    ) as { id: string };
    const inventoryBefore = Number(
      runSql(
        "full_chain",
        `select inventory_qty from public.product_variants where id = '${ids.manifestPhysicalVariant}'`,
      ),
    );

    runSql(
      "full_chain",
      `update public.product_variants
       set price_cents = 9999, status = 'archived'
       where id = '${ids.manifestPhysicalVariant}';
       update public.products
       set status = 'archived'
       where id = '${ids.manifestPhysicalProduct}'`,
    );

    const statement = `select row_to_json(result) from public.stub_checkout_create_paid_order_with_manifest(
      'manifest-store', 'changed@example.test', null,
      jsonb_build_array(jsonb_build_object(
        'productId', '${ids.manifestPhysicalProduct}',
        'variantId', '${ids.manifestPhysicalVariant}',
        'quantity', 99,
        'unitPriceCents', 9999
      )),
      '${paymentRef}', 9999, 'CHANGED', '${checkout.id}', null
    ) result`;
    const [first, second] = await Promise.all([
      runSqlAsync("full_chain", statement, "stub-attempt-a"),
      runSqlAsync("full_chain", statement, "stub-attempt-b"),
    ]);
    const firstResult = JSON.parse(first) as { order_id: string };
    const secondResult = JSON.parse(second) as { order_id: string };

    expect(secondResult.order_id).toBe(firstResult.order_id);
    expect(
      runSql(
        "full_chain",
        `select count(*) from public.orders where stripe_payment_intent_id = '${paymentRef}'`,
      ),
    ).toBe("1");
    expect(
      runSql(
        "full_chain",
        `select count(*) from public.inventory_movements where order_id = '${firstResult.order_id}'`,
      ),
    ).toBe("1");
    expect(
      Number(
        runSql(
          "full_chain",
          `select inventory_qty from public.product_variants where id = '${ids.manifestPhysicalVariant}'`,
        ),
      ),
    ).toBe(inventoryBefore - 1);
    expect(
      runSql(
        "full_chain",
        `select placed_order.customer_email || ':' || placed_order.customer_first_name || ':' || placed_order.customer_last_name || ':' ||
          placed_order.shipping_fee_cents::text || ':' || placed_order.subtotal_cents::text || ':' || placed_order.discount_cents::text || ':' ||
          placed_order.total_cents::text || ':' || fees.fee_bps::text || ':' || fees.platform_fee_cents::text || ':' || placed_order.promo_code
         from public.orders placed_order
         join public.order_fee_breakdowns fees on fees.order_id = placed_order.id
         where placed_order.id = '${firstResult.order_id}'`,
      ),
    ).toBe("snapshot@example.test:Snapshot:Buyer:321:1500:266:1555:777:108:SNAPSHOT");
    expect(
      runSql(
        "full_chain",
        `select unit_price_cents::text || ':' || quantity::text || ':' || variant_label
         from public.order_items where order_id = '${firstResult.order_id}'`,
      ),
    ).toBe("1500:1:Snapshot oak");
    runSql(
      "full_chain",
      `update public.product_variants
       set price_cents = 1500, status = 'active'
       where id = '${ids.manifestPhysicalVariant}';
       update public.products
       set status = 'active'
       where id = '${ids.manifestPhysicalProduct}'`,
    );
  });
});

describe("digital checkout composition database contract", () => {
  function buildAttemptStatement({
    attemptSuffix,
    fingerprintCharacter,
    composition,
    fulfillmentMethod,
    customerPhone,
    items,
    digitalPolicySql,
  }: {
    attemptSuffix: string;
    fingerprintCharacter: string;
    composition: "digital_only" | "physical_only" | "mixed";
    fulfillmentMethod: "digital_delivery" | "shipping";
    customerPhone: string | null;
    items: string;
    digitalPolicySql?: string;
  }) {
    const resolvedDigitalPolicySql = digitalPolicySql ?? (
      composition === "physical_only"
        ? ""
        : `,
            'digital_consent_version', '${DIGITAL_PRODUCT_CONFIG.consentVersion}',
            'digital_consent_accepted_at', '2026-08-13T04:00:00Z',
            'digital_license_version', '${DIGITAL_PRODUCT_CONFIG.licenseVersion}'`
    );

    return `set role service_role;
        select public.create_or_reuse_storefront_checkout_attempt(
          '${ids.manifestStore}',
          '018f6fc1-8adc-7f43-8000-${attemptSuffix}',
          '${fingerprintCharacter.repeat(64)}',
          jsonb_build_object(
            'store_slug', 'manifest-store',
            'customer_email', 'composition@example.test',
            'customer_first_name', 'Composition',
            'customer_last_name', 'Buyer',
            'customer_phone', ${customerPhone === null ? "null" : `'${customerPhone}'`},
            'fulfillment_method', '${fulfillmentMethod}',
            'fulfillment_label', '${fulfillmentMethod === "digital_delivery" ? "Digital delivery" : "Shipping"}',
            'shipping_fee_cents', ${fulfillmentMethod === "digital_delivery" ? 0 : 700},
            'promo_codes_json', '[]'::jsonb,
            'applied_promotions_json', '[]'::jsonb,
            'fee_plan_key', 'standard',
            'fee_bps', 500,
            'fee_fixed_cents', 0,
            'item_total_cents', 4000,
            'platform_fee_cents', 200,
            'attribution_json', '{}'::jsonb,
            'items', ${items},
            'checkout_composition', '${composition}',
            'checkout_mode', 'stub',
            'tax_collection_mode_snapshot', 'seller_attested_no_tax'${resolvedDigitalPolicySql},
            'status', 'pending'
          )
        );
        reset role`;
  }

  function createAttempt(input: Parameters<typeof buildAttemptStatement>[0]) {
    return JSON.parse(runSql("full_chain", buildAttemptStatement(input))) as {
      id: string;
      checkout_composition: string;
    };
  }

  const digitalItem = (quantity = 1) => `jsonb_build_object(
    'productId', '${ids.manifestProduct}',
    'variantId', '${ids.manifestVariant}',
    'quantity', ${quantity},
    'variantLabel', 'Blue',
    'productTitle', 'Digital set',
    'productType', 'digital',
    'unitPriceCents', 2500
  )`;
  const physicalItem = (quantity = 1) => `jsonb_build_object(
    'productId', '${ids.manifestPhysicalProduct}',
    'variantId', '${ids.manifestPhysicalVariant}',
    'quantity', ${quantity},
    'variantLabel', 'Oak',
    'productTitle', 'Frame',
    'productType', 'physical',
    'unitPriceCents', 1500
  )`;

  it("rejects direct digital and mixed attempts without the configured consent and license snapshots", () => {
    expectRejected("full_chain", buildAttemptStatement({
      attemptSuffix: "000000000616",
      fingerprintCharacter: "6",
      composition: "digital_only",
      fulfillmentMethod: "digital_delivery",
      customerPhone: null,
      items: `jsonb_build_array(${digitalItem()})`,
      digitalPolicySql: ""
    }));
    expectRejected("full_chain", buildAttemptStatement({
      attemptSuffix: "000000000617",
      fingerprintCharacter: "7",
      composition: "mixed",
      fulfillmentMethod: "shipping",
      customerPhone: "555-0117",
      items: `jsonb_build_array(${digitalItem()}, ${physicalItem()})`,
      digitalPolicySql: `,
        'digital_consent_version', '${DIGITAL_PRODUCT_CONFIG.consentVersion}',
        'digital_consent_accepted_at', '2026-08-13T04:00:00Z',
        'digital_license_version', 'wrong-license-v1'`
    }));
    expectRejected("full_chain", buildAttemptStatement({
      attemptSuffix: "000000000620",
      fingerprintCharacter: "a",
      composition: "digital_only",
      fulfillmentMethod: "digital_delivery",
      customerPhone: null,
      items: `jsonb_build_array(${digitalItem()})`,
      digitalPolicySql: `,
        'digital_consent_version', 'wrong-consent-v1',
        'digital_consent_accepted_at', '2026-08-13T04:00:00Z',
        'digital_license_version', '${DIGITAL_PRODUCT_CONFIG.licenseVersion}'`
    }));
    expectRejected("full_chain", buildAttemptStatement({
      attemptSuffix: "000000000621",
      fingerprintCharacter: "b",
      composition: "mixed",
      fulfillmentMethod: "shipping",
      customerPhone: "555-0121",
      items: `jsonb_build_array(${digitalItem()}, ${physicalItem()})`,
      digitalPolicySql: `,
        'digital_consent_version', '${DIGITAL_PRODUCT_CONFIG.consentVersion}',
        'digital_consent_accepted_at', now() + interval '1 day',
        'digital_license_version', '${DIGITAL_PRODUCT_CONFIG.licenseVersion}'`
    }));
  });

  it("derives digital policy requirements from catalog identity instead of forged item labels", () => {
    expectRejected(
      "full_chain",
      `insert into public.storefront_checkout_sessions(
         id, store_id, store_slug, customer_email, items, checkout_composition,
         fulfillment_method, fulfillment_label, shipping_fee_cents, checkout_mode,
         tax_collection_mode_snapshot, applied_promotions_json, status
       ) values (
         '42000000-0000-4000-8000-000000000622', '${ids.manifestStore}',
         'manifest-store', 'forged-label@example.test',
         jsonb_build_array(jsonb_build_object(
           'productId', '${ids.manifestProduct}',
           'variantId', '${ids.manifestVariant}',
           'quantity', 1,
           'productType', 'physical',
           'unitPriceCents', 2500
         )),
         'physical_only', 'shipping', 'Shipping', 0, 'stub',
         'seller_attested_no_tax', '[]'::jsonb, 'pending'
       )`,
    );

    expectRejected(
      "full_chain",
      `insert into public.storefront_checkout_sessions(
         id, store_id, store_slug, customer_email, items, checkout_composition, status
       ) values (
         '42000000-0000-4000-8000-000000000623', '${ids.manifestStore}',
         'manifest-store', 'mismatch@example.test',
         jsonb_build_array(jsonb_build_object(
           'productId', '${ids.manifestProduct}',
           'variantId', '${ids.manifestPhysicalVariant}',
           'quantity', 1,
           'productType', 'physical',
           'unitPriceCents', 1500
         )),
         'pending'
       )`,
    );
  });

  it("rejects catalog type and authoritative composition mismatches even with valid digital policy", () => {
    expectRejected(
      "full_chain",
      `insert into public.storefront_checkout_sessions(
         id, store_id, store_slug, customer_email, items, checkout_composition,
         digital_consent_version, digital_consent_accepted_at,
         digital_license_version, status
       ) values (
         '42000000-0000-4000-8000-000000000624', '${ids.manifestStore}',
         'manifest-store', 'forged-policy@example.test',
         jsonb_build_array(jsonb_build_object(
           'productId', '${ids.manifestProduct}',
           'variantId', '${ids.manifestVariant}',
           'quantity', 1, 'productType', 'physical', 'unitPriceCents', 2500
         )),
         'physical_only', '${DIGITAL_PRODUCT_CONFIG.consentVersion}', now(),
         '${DIGITAL_PRODUCT_CONFIG.licenseVersion}', 'pending'
       )`,
    );

    expectRejected(
      "full_chain",
      `insert into public.storefront_checkout_sessions(
         id, store_id, store_slug, customer_email, items, checkout_composition,
         digital_consent_version, digital_consent_accepted_at,
         digital_license_version, status
       ) values (
         '42000000-0000-4000-8000-000000000625', '${ids.manifestStore}',
         'manifest-store', 'wrong-composition@example.test',
         jsonb_build_array(${digitalItem()}),
         'physical_only', '${DIGITAL_PRODUCT_CONFIG.consentVersion}', now(),
         '${DIGITAL_PRODUCT_CONFIG.licenseVersion}', 'pending'
       )`,
    );

    expectRejected(
      "full_chain",
      `insert into public.storefront_checkout_sessions(
         id, store_id, store_slug, customer_email, items, checkout_composition, status
       ) values (
         '42000000-0000-4000-8000-000000000626', '${ids.manifestStore}',
         'manifest-store', 'wrong-physical-composition@example.test',
         jsonb_build_array(${physicalItem()}), 'digital_only', 'pending'
       )`,
    );
  });

  it("requires authoritative composition on new rows while preserving legacy null snapshots", () => {
    expectRejected(
      "full_chain",
      `insert into public.storefront_checkout_sessions(
         id, store_id, store_slug, customer_email, items, checkout_composition, status
       ) values (
         '42000000-0000-4000-8000-000000000627', '${ids.manifestStore}',
         'manifest-store', 'new-null@example.test',
         jsonb_build_array(${physicalItem()}), null, 'pending'
       )`,
    );

    expect(runSql(
      "full_chain",
      `update public.storefront_checkout_sessions
       set digital_consent_version = 'legacy-maintenance'
       where id = '${ids.legacyNullCheckout}'
       returning coalesce(checkout_composition, 'legacy-null')`,
    )).toBe("legacy-null");
  });

  it("accepts configured digital policy snapshots while leaving physical-only attempts unaffected", () => {
    expect(createAttempt({
      attemptSuffix: "000000000618",
      fingerprintCharacter: "8",
      composition: "digital_only",
      fulfillmentMethod: "digital_delivery",
      customerPhone: null,
      items: `jsonb_build_array(${digitalItem()})`
    }).checkout_composition).toBe("digital_only");
    expect(createAttempt({
      attemptSuffix: "000000000619",
      fingerprintCharacter: "9",
      composition: "physical_only",
      fulfillmentMethod: "shipping",
      customerPhone: "555-0119",
      items: `jsonb_build_array(${physicalItem()})`
    }).checkout_composition).toBe("physical_only");

    expect(runSql(
      "full_chain",
      `insert into public.storefront_checkout_sessions(
         id, store_id, store_slug, customer_email, items, checkout_composition, status
       ) values (
         '42000000-0000-4000-8000-000000000619', '${ids.manifestStore}',
         'manifest-store', 'legacy-physical@example.test',
         jsonb_build_array(${physicalItem()}), 'physical_only', 'pending'
       ) returning id`,
    )).toBe("42000000-0000-4000-8000-000000000619");
  });

  it("preserves a pre-migration digital attempt and resumes it without mutable revalidation", () => {
    const retry = JSON.parse(runSql(
      "full_chain",
      `set role service_role;
       select public.create_or_reuse_storefront_checkout_attempt(
         '${ids.policyUpgradeStore}', '018f6fc1-8adc-7f43-8000-000000000641',
         '${"c".repeat(64)}', '{}'::jsonb
       );
       reset role`,
    )) as {
      id: string;
      created: boolean;
      checkout_composition: string;
      digital_consent_version: string | null;
    };

    expect(retry).toMatchObject({
      id: ids.policyUpgradeCheckout,
      created: false,
      checkout_composition: "digital_only",
      digital_consent_version: null
    });
  });

  it("keeps digital policy configuration private and aligned with application defaults", () => {
    expect(runSql(
      "full_chain",
      `select consent_version || ':' || license_version
       from public.digital_checkout_policy_versions where singleton = true`,
    )).toBe(`${DIGITAL_PRODUCT_CONFIG.consentVersion}:${DIGITAL_PRODUCT_CONFIG.licenseVersion}`);
    expect(runSql(
      "full_chain",
      `select
        has_table_privilege('anon', 'public.digital_checkout_policy_versions', 'select')::text || ':' ||
        has_table_privilege('authenticated', 'public.digital_checkout_policy_versions', 'select')::text || ':' ||
        has_function_privilege('service_role', 'public.create_or_reuse_storefront_checkout_attempt(uuid,text,text,jsonb)', 'execute')::text`,
    )).toBe("false:false:true");
  });

  it("finalizes a zero-inventory digital-only order without inventory mutation", () => {
    runSql(
      "full_chain",
      `update public.product_variants set inventory_qty = 0 where id = '${ids.manifestVariant}'`,
    );
    const checkout = createAttempt({
      attemptSuffix: "000000000611",
      fingerprintCharacter: "1",
      composition: "digital_only",
      fulfillmentMethod: "digital_delivery",
      customerPhone: null,
      items: `jsonb_build_array(${digitalItem()})`,
    });

    const result = JSON.parse(
      runSql(
        "full_chain",
        `select row_to_json(result) from public.stub_checkout_create_paid_order_with_manifest(
          'manifest-store', 'ignored@example.test', null, '[]'::jsonb,
          'stub_pi_composition_digital', 0, null, '${checkout.id}', null
        ) result`,
      ),
    ) as { order_id: string };

    expect(
      runSql(
        "full_chain",
        `select inventory_qty::text from public.product_variants where id = '${ids.manifestVariant}'`,
      ),
    ).toBe("0");
    expect(
      runSql(
        "full_chain",
        `select count(*) from public.inventory_movements where order_id = '${result.order_id}'`,
      ),
    ).toBe("0");
    expect(
      runSql(
        "full_chain",
        `select product_type || ':' || quantity::text from public.order_items where order_id = '${result.order_id}'`,
      ),
    ).toBe("digital:1");
    expect(
      runSql(
        "full_chain",
        `select fulfillment_method || ':' || coalesce(customer_phone, 'null') || ':' || shipping_fee_cents::text
         from public.orders where id = '${result.order_id}'`,
      ),
    ).toBe("digital_delivery:null:0");
  });

  it("mutates inventory only for the physical line in a mixed order", () => {
    runSql(
      "full_chain",
      `update public.product_variants set inventory_qty = 0 where id = '${ids.manifestVariant}';
       update public.product_variants set inventory_qty = 10 where id = '${ids.manifestPhysicalVariant}'`,
    );
    const checkout = createAttempt({
      attemptSuffix: "000000000612",
      fingerprintCharacter: "2",
      composition: "mixed",
      fulfillmentMethod: "shipping",
      customerPhone: "555-0112",
      items: `jsonb_build_array(${digitalItem()}, ${physicalItem(2)})`,
    });
    const result = JSON.parse(
      runSql(
        "full_chain",
        `select row_to_json(result) from public.stub_checkout_create_paid_order_with_manifest(
          'manifest-store', 'ignored@example.test', null, '[]'::jsonb,
          'stub_pi_composition_mixed', 0, null, '${checkout.id}', null
        ) result`,
      ),
    ) as { order_id: string };

    expect(
      runSql(
        "full_chain",
        `select inventory_qty::text from public.product_variants where id = '${ids.manifestVariant}'`,
      ),
    ).toBe("0");
    expect(
      runSql(
        "full_chain",
        `select inventory_qty::text from public.product_variants where id = '${ids.manifestPhysicalVariant}'`,
      ),
    ).toBe("8");
    expect(
      runSql(
        "full_chain",
        `select count(*) || ':' || (array_agg(product_variant_id order by product_variant_id))[1]::text || ':' || sum(delta_qty)::text
         from public.inventory_movements where order_id = '${result.order_id}'`,
      ),
    ).toBe(`1:${ids.manifestPhysicalVariant}:-2`);
    expect(
      runSql(
        "full_chain",
        `select string_agg(product_type || ':' || quantity::text, ',' order by product_type)
         from public.order_items where order_id = '${result.order_id}'`,
      ),
    ).toBe("digital:1,physical:2");
  });

  it("rejects invalid digital quantities and forged product type snapshots", () => {
    expectRejected(
      "full_chain",
      `select public.create_or_reuse_storefront_checkout_attempt(
        '${ids.manifestStore}', '018f6fc1-8adc-7f43-8000-000000000613', '${"3".repeat(64)}',
        jsonb_build_object(
          'store_slug', 'manifest-store', 'customer_email', 'bad@example.test',
          'items', jsonb_build_array(${digitalItem(2)}),
          'checkout_composition', 'digital_only', 'fulfillment_method', 'digital_delivery',
          'shipping_fee_cents', 0, 'checkout_mode', 'stub',
          'tax_collection_mode_snapshot', 'seller_attested_no_tax',
          'applied_promotions_json', '[]'::jsonb, 'status', 'pending'
        )
      )`,
    );
    expectRejected(
      "full_chain",
      `select public.create_or_reuse_storefront_checkout_attempt(
        '${ids.manifestStore}', '018f6fc1-8adc-7f43-8000-000000000614', '${"4".repeat(64)}',
        jsonb_build_object(
          'store_slug', 'manifest-store', 'customer_email', 'bad@example.test',
          'items', jsonb_build_array(jsonb_build_object(
            'productId', '${ids.manifestProduct}', 'variantId', '${ids.manifestVariant}',
            'quantity', 1, 'productType', 'physical', 'unitPriceCents', 2500
          )),
          'checkout_composition', 'physical_only', 'fulfillment_method', 'shipping',
          'shipping_fee_cents', 0, 'checkout_mode', 'stub',
          'tax_collection_mode_snapshot', 'seller_attested_no_tax',
          'applied_promotions_json', '[]'::jsonb, 'status', 'pending'
        )
      )`,
    );
  });

  it("keeps item types and composition immutable after attempt creation", () => {
    const checkout = createAttempt({
      attemptSuffix: "000000000615",
      fingerprintCharacter: "5",
      composition: "physical_only",
      fulfillmentMethod: "shipping",
      customerPhone: "555-0115",
      items: `jsonb_build_array(${physicalItem()})`,
    });

    expectRejected(
      "full_chain",
      `update public.storefront_checkout_sessions
       set checkout_composition = 'digital_only', items = jsonb_build_array(${digitalItem()})
       where id = '${checkout.id}'`,
    );
  });
});

describe("authenticated customer cart repair", () => {
  it("transactionally persists only active exact selections with current digital quantities", () => {
    runSql(
      "full_chain",
      `insert into public.products(
         id, store_id, title, description, price_cents, inventory_qty, status, product_type
       ) values
         ('${ids.cartChangedProduct}', '${ids.manifestStore}', 'Changed cart item', '', 1200, 5, 'active', 'physical'),
         ('${ids.cartArchivedProduct}', '${ids.manifestStore}', 'Archived cart item', '', 1300, 5, 'active', 'physical');
       insert into public.product_variants(
         id, store_id, product_id, price_cents, inventory_qty, is_default, status
       ) values
         ('${ids.cartChangedVariant}', '${ids.manifestStore}', '${ids.cartChangedProduct}', 1200, 5, true, 'active'),
         ('${ids.cartArchivedVariant}', '${ids.manifestStore}', '${ids.cartArchivedProduct}', 1300, 5, true, 'active');
       insert into public.customer_carts(id, user_id, store_id, status)
       values (
         '${ids.cartRepairCart}', '00000000-0000-4000-8000-000000000011',
         '${ids.manifestStore}', 'active'
       );
       insert into public.customer_cart_items(
         cart_id, product_id, product_variant_id, quantity, unit_price_snapshot_cents
       ) values
         ('${ids.cartRepairCart}', '${ids.manifestProduct}', '${ids.manifestVariant}', 9, 999),
         ('${ids.cartRepairCart}', '${ids.cartChangedProduct}', '${ids.cartChangedVariant}', 7, 999),
         ('${ids.cartRepairCart}', '${ids.cartArchivedProduct}', '${ids.cartArchivedVariant}', 3, 999),
         ('${ids.cartRepairCart}', '${ids.manifestProduct}', '${ids.cartChangedVariant}', 2, 999);
       insert into public.digital_product_assets(
         id, store_id, product_id, product_variant_id, label, active
       ) values (
         '${ids.cartChangedAsset}', '${ids.manifestStore}', '${ids.cartChangedProduct}',
         null, 'Changed product file', true
       );
       insert into public.digital_product_asset_versions(
         id, asset_id, version_number, storage_path, customer_filename,
         mime_type, byte_size, checksum_sha256, status
       ) values (
         '${ids.cartChangedVersion}', '${ids.cartChangedAsset}', 1,
         '${ids.manifestStore}/${ids.cartChangedProduct}/${ids.cartChangedAsset}/v1/changed.pdf',
         'changed.pdf', 'application/pdf', 10, repeat('5', 64), 'ready'
       );
       insert into public.digital_product_previews(
         product_id, source_asset_version_id, public_preview_path, status
       ) values (
         '${ids.cartChangedProduct}', '${ids.cartChangedVersion}',
         '${ids.manifestStore}/${ids.cartChangedProduct}/preview.jpg', 'ready'
       );
       update public.products
       set product_type = 'digital',
           digital_rights_affirmed_at = now(),
           digital_rights_affirmed_by_user_id = '00000000-0000-4000-8000-000000000011'
       where id = '${ids.cartChangedProduct}';
       update public.product_variants set status = 'archived'
       where id = '${ids.cartArchivedVariant}';
       create or replace function auth.uid() returns uuid language sql stable
       as 'select ''00000000-0000-4000-8000-000000000011''::uuid';`,
    );

    const repaired = runSql(
      "full_chain",
      `set role authenticated;
       select string_agg(
         product_id::text || ':' || product_variant_id::text || ':' || quantity::text,
         ',' order by product_id
       ) from public.repair_authenticated_customer_cart('${ids.cartRepairCart}');
       reset role`,
    );

    expect(repaired).toBe(
      `${ids.manifestProduct}:${ids.manifestVariant}:1,` +
      `${ids.cartChangedProduct}:${ids.cartChangedVariant}:1`,
    );
    expect(runSql(
      "full_chain",
      `select string_agg(
         product_id::text || ':' || product_variant_id::text || ':' || quantity::text || ':' || unit_price_snapshot_cents::text,
         ',' order by product_id
       ) from public.customer_cart_items where cart_id = '${ids.cartRepairCart}'`,
    )).toBe(
      `${ids.manifestProduct}:${ids.manifestVariant}:1:2500,` +
      `${ids.cartChangedProduct}:${ids.cartChangedVariant}:1:1200`,
    );
  });

  it("limits every cart mutation boundary to authenticated customers", () => {
    expect(runSql(
      "full_chain",
      `select
         has_function_privilege('anon', 'public.repair_authenticated_customer_cart(uuid)', 'execute')::text || ':' ||
         has_function_privilege('authenticated', 'public.repair_authenticated_customer_cart(uuid)', 'execute')::text || ':' ||
         has_function_privilege('service_role', 'public.repair_authenticated_customer_cart(uuid)', 'execute')::text || ':' ||
         has_function_privilege('anon', 'public.replace_authenticated_customer_cart_items(uuid,jsonb)', 'execute')::text || ':' ||
         has_function_privilege('authenticated', 'public.replace_authenticated_customer_cart_items(uuid,jsonb)', 'execute')::text || ':' ||
         has_function_privilege('service_role', 'public.replace_authenticated_customer_cart_items(uuid,jsonb)', 'execute')::text || ':' ||
         has_function_privilege('anon', 'public.clear_authenticated_customer_cart(uuid)', 'execute')::text || ':' ||
         has_function_privilege('authenticated', 'public.clear_authenticated_customer_cart(uuid)', 'execute')::text || ':' ||
         has_function_privilege('service_role', 'public.clear_authenticated_customer_cart(uuid)', 'execute')::text`,
    )).toBe("false:true:false:false:true:false:false:true:false");
    expect(runSql(
      "full_chain",
      `select
         has_table_privilege('authenticated', 'public.customer_cart_items', 'insert')::text || ':' ||
         has_table_privilege('authenticated', 'public.customer_cart_items', 'update')::text || ':' ||
         has_table_privilege('authenticated', 'public.customer_cart_items', 'delete')::text || ':' ||
         has_table_privilege('service_role', 'public.customer_cart_items', 'insert')::text || ':' ||
         has_table_privilege('service_role', 'public.customer_cart_items', 'update')::text || ':' ||
         has_table_privilege('service_role', 'public.customer_cart_items', 'delete')::text`,
    )).toBe("false:false:false:false:false:false");
  });

  it("does not let an authenticated customer mutate another customer's cart", () => {
    runSql(
      "full_chain",
      `create or replace function auth.uid() returns uuid language sql stable
       as 'select ''00000000-0000-4000-8000-000000000099''::uuid';`,
    );

    expect(runSql(
      "full_chain",
      `set role authenticated;
       select count(*)::text
       from public.repair_authenticated_customer_cart('${ids.cartRepairCart}');
       reset role`,
    )).toBe("0");
    expect(runSql(
      "full_chain",
      `set role authenticated;
       select public.replace_authenticated_customer_cart_items(
         '${ids.cartRepairCart}', '[]'::jsonb
       )::text;
       reset role`,
    )).toBe("false");
    expect(runSql(
      "full_chain",
      `set role authenticated;
       select public.clear_authenticated_customer_cart('${ids.cartRepairCart}')::text;
       reset role`,
    )).toBe("false");
    expectRejected(
      "full_chain",
      `set role authenticated;
       delete from public.customer_cart_items
       where cart_id = '${ids.cartRepairCart}'`,
    );

    runSql(
      "full_chain",
      `create or replace function auth.uid() returns uuid language sql stable
       as 'select ''00000000-0000-4000-8000-000000000011''::uuid';`,
    );
  });

  it("serializes repair against clear without resurrecting abandoned cart items", async () => {
    const raceCart = "42000000-0000-4000-8000-000000000061";
    const raceUser = "00000000-0000-4000-8000-000000000012";
    runSql(
      "full_chain",
      `insert into auth.users(id, email)
       values ('${raceUser}', 'cart-race@example.test');
       insert into public.customer_carts(id, user_id, store_id, status)
       values ('${raceCart}', '${raceUser}', '${ids.manifestStore}', 'active');
       insert into public.customer_cart_items(
         cart_id, product_id, product_variant_id, quantity, unit_price_snapshot_cents
       ) values (
         '${raceCart}', '${ids.manifestProduct}', '${ids.manifestVariant}', 9, 999
       );
       create or replace function auth.uid() returns uuid language sql stable
       as 'select ''${raceUser}''::uuid';`,
    );

    const repair = runSqlAsync(
      "full_chain",
      `begin;
       set local role authenticated;
       select count(*) from public.repair_authenticated_customer_cart('${raceCart}');
       select pg_sleep(1.5);
       commit;`,
      "customer-cart-repair-race",
    );
    await waitForPostgresSession("full_chain", "customer-cart-repair-race");

    const clear = runSqlAsync(
      "full_chain",
      `set role authenticated;
       select public.clear_authenticated_customer_cart('${raceCart}')::text;
       reset role;`,
      "customer-cart-clear-race",
    );
    await waitForPostgresLock("full_chain", "customer-cart-clear-race");

    const [repairResult, clearResult] = await Promise.all([repair, clear]);
    expect(repairResult.split("\n")[0]).toBe("1");
    expect(clearResult).toBe("true");
    expect(runSql(
      "full_chain",
      `select cart.status || ':' || count(item.id)::text
       from public.customer_carts cart
       left join public.customer_cart_items item on item.cart_id = cart.id
       where cart.id = '${raceCart}'
       group by cart.status`,
    )).toBe("abandoned:0");
    runSql(
      "full_chain",
      `create or replace function auth.uid() returns uuid language sql stable
       as 'select ''00000000-0000-4000-8000-000000000011''::uuid';`,
    );
  });

  it("returns an empty repair after a concurrent clear wins the parent lock", async () => {
    const raceCart = "42000000-0000-4000-8000-000000000062";
    const raceUser = "00000000-0000-4000-8000-000000000013";
    runSql(
      "full_chain",
      `insert into auth.users(id, email)
       values ('${raceUser}', 'cart-clear-first@example.test');
       insert into public.customer_carts(id, user_id, store_id, status)
       values ('${raceCart}', '${raceUser}', '${ids.manifestStore}', 'active');
       insert into public.customer_cart_items(
         cart_id, product_id, product_variant_id, quantity, unit_price_snapshot_cents
       ) values (
         '${raceCart}', '${ids.manifestProduct}', '${ids.manifestVariant}', 9, 999
       );
       create or replace function auth.uid() returns uuid language sql stable
       as 'select ''${raceUser}''::uuid';`,
    );

    const clear = runSqlAsync(
      "full_chain",
      `begin;
       set local role authenticated;
       select public.clear_authenticated_customer_cart('${raceCart}')::text;
       select pg_sleep(1.5);
       commit;`,
      "customer-cart-clear-first-race",
    );
    await waitForPostgresSession("full_chain", "customer-cart-clear-first-race");

    const repair = runSqlAsync(
      "full_chain",
      `set role authenticated;
       select count(*)::text
       from public.repair_authenticated_customer_cart('${raceCart}');
       reset role;`,
      "customer-cart-repair-second-race",
    );
    await waitForPostgresLock("full_chain", "customer-cart-repair-second-race");

    const [clearResult, repairResult] = await Promise.all([clear, repair]);
    expect(clearResult.split("\n")[0]).toBe("true");
    expect(repairResult).toBe("0");
    expect(runSql(
      "full_chain",
      `select cart.status || ':' || count(item.id)::text
       from public.customer_carts cart
       left join public.customer_cart_items item on item.cart_id = cart.id
       where cart.id = '${raceCart}'
       group by cart.status`,
    )).toBe("abandoned:0");
    runSql(
      "full_chain",
      `create or replace function auth.uid() returns uuid language sql stable
       as 'select ''00000000-0000-4000-8000-000000000011''::uuid';`,
    );
  });
});

describe("immutable purchase manifests", () => {
  it("rejects locking while an item is not associated with the manifest order", () => {
    runSql(
      "upgrade",
      `insert into public.digital_purchase_manifests(
        id, store_id, order_id, consent_version, license_version
      ) values (
        'b0000000-0000-0000-0000-000000000002', '${ids.storeB}', '${ids.orderB}',
        'immediate-delivery-v1', 'personal-use-v1'
      );
      insert into public.digital_purchase_manifest_items(
        manifest_id, store_id, product_id, product_variant_id, asset_id,
        asset_version_id, customer_filename, mime_type, byte_size,
        checksum_sha256, label, sort_order
      ) values (
        'b0000000-0000-0000-0000-000000000002', '${ids.storeB}', '${ids.productB}',
        '${ids.variantB}', '${ids.assetB}', '${ids.versionB}', 'b.pdf',
        'application/pdf', 10, repeat('c', 64), 'File B', 0
      )`,
    );

    expectRejected(
      "upgrade",
      `update public.digital_purchase_manifests
       set status = 'locked', locked_at = now()
       where id = 'b0000000-0000-0000-0000-000000000002'`,
    );
  });

  it("blocks direct mutation after locking and permits an audited service-role repair", () => {
    runSql(
      "upgrade",
      `insert into public.digital_purchase_manifest_items(
        id, manifest_id, store_id, order_id, order_item_id, product_id, product_variant_id,
        asset_id, asset_version_id, customer_filename, mime_type, byte_size,
        checksum_sha256, label, sort_order
      ) values (
        '${ids.manifestItemA}', '${ids.manifestA}', '${ids.storeA}', '${ids.orderA}', '${ids.itemA}',
        '${ids.productA}', '${ids.variantA}', '${ids.assetA}', '${ids.versionA}',
        'a.pdf', 'application/pdf', 10, repeat('a', 64), 'File A', 0
      );
      update public.digital_purchase_manifests
      set status = 'locked', locked_at = now()
      where id = '${ids.manifestA}'`,
    );

    expectRejected(
      "upgrade",
      `update public.digital_purchase_manifest_items set label = 'Changed' where id = '${ids.manifestItemA}'`,
    );
    expectRejected(
      "upgrade",
      `delete from public.digital_purchase_manifest_items where id = '${ids.manifestItemA}'`,
    );
    expectRejected(
      "upgrade",
      `update public.digital_purchase_manifests set license_version = 'changed' where id = '${ids.manifestA}'`,
    );

    runSql(
      "upgrade",
      `set role service_role;
       select public.admin_repair_digital_purchase_manifest_item(
         '${ids.manifestItemA}', 'repaired.pdf', 'application/pdf', 10,
         repeat('a', 64), 'Repaired label', 0, 'Support-approved metadata correction'
       );
       reset role`,
    );
    expect(
      runSql(
        "upgrade",
        `select label from public.digital_purchase_manifest_items where id = '${ids.manifestItemA}'`,
      ),
    ).toBe("Repaired label");
    expect(
      runSql(
        "upgrade",
        `select count(*) from public.digital_manifest_repair_audit where subject_id = '${ids.manifestItemA}'`,
      ),
    ).toBe("1");
  });
});

describe("durable delivery and download state", () => {
  it("models unique durable jobs and safe attempts", () => {
    runSql(
      "upgrade",
      `insert into public.digital_delivery_jobs(store_id, order_id, job_type)
       values ('${ids.storeA}', '${ids.orderA}', 'provision_entitlements')`,
    );
    expectRejected(
      "upgrade",
      `insert into public.digital_delivery_jobs(store_id, order_id, job_type)
       values ('${ids.storeA}', '${ids.orderA}', 'provision_entitlements')`,
    );
    expectRejected(
      "upgrade",
      `insert into public.digital_delivery_jobs(store_id, order_id, job_type, attempt_count)
       values ('${ids.storeA}', '${ids.orderA2}', 'send_access_email', -1)`,
    );
    expect(
      runSql(
        "upgrade",
        `select count(*) from information_schema.columns
         where table_schema = 'public'
           and table_name in ('digital_delivery_jobs', 'digital_delivery_attempts')
           and column_name in ('token', 'token_hash', 'storage_path', 'signed_url', 'bearer_token')`,
      ),
    ).toBe("0");
  });

  it("increments usage only when a reservation commits", () => {
    runSql(
      "upgrade",
      `insert into public.digital_product_asset_versions(
        id, asset_id, product_id, store_id, version_number, storage_path,
        customer_filename, mime_type, byte_size, checksum_sha256, status,
        upload_completed_at
      ) values (
        '70000000-0000-0000-0000-000000000004', '${ids.assetA}', '${ids.productA}',
        '${ids.storeA}', 2, 'private/a-v2', 'a-v2.pdf', 'application/pdf', 10,
        repeat('e', 64), 'ready', now()
      );
      insert into public.digital_order_entitlements(
        id, store_id, order_id, order_item_id, product_id, product_variant_id,
        asset_id, asset_version_id, customer_filename, mime_type, byte_size,
        license_version, max_download_grants
      ) values (
        '${ids.entitlementReserve}', '${ids.storeA}', '${ids.orderA}', '${ids.itemA}',
        '${ids.productA}', '${ids.variantA}', '${ids.assetA}',
        '70000000-0000-0000-0000-000000000004', 'a-v2.pdf', 'application/pdf', 10,
        'personal-use-v1', 2
      )`,
    );

    const reservation = JSON.parse(
      runSql(
        "upgrade",
        `select to_jsonb(reservation) from public.reserve_digital_download_grant(
          '${ids.entitlementReserve}', '${ids.tokenA}', 'reservation-a', repeat('f', 64)
        ) reservation`,
      ),
    ) as Record<string, unknown>;
    expect(reservation).toMatchObject({
      asset_version_id: "70000000-0000-0000-0000-000000000004",
      customer_filename: "a-v2.pdf",
      grant_status: "reserved",
    });
    expect(reservation).not.toHaveProperty("storage_path");
    const grantId = reservation.grant_id;
    expect(grantId).toEqual(expect.any(String));
    expect(
      runSql(
        "upgrade",
        `select download_grants_used from public.digital_order_entitlements where id = '${ids.entitlementReserve}'`,
      ),
    ).toBe("0");

    runSql(
      "upgrade",
      `select public.commit_digital_download_grant('${String(grantId)}', repeat('f', 64))`,
    );
    expect(
      runSql(
        "upgrade",
        `select download_grants_used from public.digital_order_entitlements where id = '${ids.entitlementReserve}'`,
      ),
    ).toBe("1");

    const releasedGrantId = runSql(
      "upgrade",
      `select grant_id from public.reserve_digital_download_grant(
        '${ids.entitlementReserve}', '${ids.tokenA}', 'reservation-b', repeat('f', 64)
      )`,
    );
    runSql(
      "upgrade",
      `select public.release_digital_download_grant('${releasedGrantId}', repeat('f', 64), 'Signing failed safely')`,
    );
    expect(
      runSql(
        "upgrade",
        `select download_grants_used from public.digital_order_entitlements where id = '${ids.entitlementReserve}'`,
      ),
    ).toBe("1");
  });

  it("rejects failed grants without a bounded safe error", () => {
    expectRejected(
      "upgrade",
      `update public.digital_download_grants
       set status = 'failed',
           issued_at = null,
           grace_expires_at = null,
           failed_at = now(),
           last_safe_error = null
       where id = '${ids.legacyGrant}'`,
    );
  });

  it("records orphan cleanup metadata and restricts original-object reads", () => {
    runSql(
      "upgrade",
      `insert into public.digital_product_asset_versions(
        id, asset_id, product_id, store_id, version_number, storage_path,
        customer_filename, mime_type, byte_size, checksum_sha256, status
      ) values (
        '70000000-0000-0000-0000-000000000005', '${ids.assetA}', '${ids.productA}',
        '${ids.storeA}', 3, 'private/pending', 'pending.pdf', 'application/pdf', 10,
        repeat('1', 64), 'uploading'
      )`,
    );
    expect(
      runSql(
        "upgrade",
        `select (orphan_cleanup_after is not null)::text
         from public.digital_product_asset_versions
         where id = '70000000-0000-0000-0000-000000000005'`,
      ),
    ).toBe("true");
    expect(
      runSql(
        "upgrade",
        `select count(*) from pg_policies
         where schemaname = 'storage'
           and tablename = 'objects'
           and policyname in ('digital_originals_never_public_read', 'digital_previews_public_read')`,
      ),
    ).toBe("2");
  });
});

describe("transactional digital asset lifecycle", () => {
  it("keeps database lifecycle limits aligned with validated application config", () => {
    expect(
      runSql(
        "fresh",
        "select public.digital_asset_max_active_files()::text || ':' || public.digital_asset_max_file_bytes()::text || ':' || extract(epoch from public.digital_asset_max_intent_ttl())::bigint::text || ':' || extract(epoch from public.digital_preview_processing_lease())::bigint::text",
      ),
    ).toBe(
      `${DIGITAL_PRODUCT_CONFIG.maxFilesPerProduct}:${DIGITAL_PRODUCT_CONFIG.maxFileBytes}:${DIGITAL_PRODUCT_CONFIG.maxUploadIntentTtlSeconds}:${DIGITAL_PRODUCT_CONFIG.previewProcessingLeaseSeconds}`,
    );
  });

  it("keeps concurrency lifecycle functions service-role only", () => {
    expect(
      runSql(
        "fresh",
        `select
          has_function_privilege('anon', 'public.expire_digital_asset_upload_intent(uuid,uuid)', 'execute')::text || ':' ||
          has_function_privilege('anon', 'public.finalize_digital_asset_upload_intent(uuid,uuid,bigint,text,text)', 'execute')::text || ':' ||
          has_function_privilege('anon', 'public.begin_digital_product_preview(uuid,uuid,uuid)', 'execute')::text || ':' ||
          has_function_privilege('anon', 'public.complete_digital_product_preview(uuid,uuid,uuid,text,uuid)', 'execute')::text || ':' ||
          has_function_privilege('anon', 'public.fail_digital_product_preview(uuid,uuid,uuid,text)', 'execute')::text || ':' ||
          has_function_privilege('service_role', 'public.expire_digital_asset_upload_intent(uuid,uuid)', 'execute')::text || ':' ||
          has_function_privilege('service_role', 'public.complete_digital_product_preview(uuid,uuid,uuid,text,uuid)', 'execute')::text`,
      ),
    ).toBe("false:false:false:false:false:true:true");
  });

  it("normalizes duplicate pending replacements when upgrading existing data", () => {
    expect(
      runSql(
        "upgrade",
        `select string_agg(version_number::text || ':' || status, ',' order by version_number)
         from public.digital_asset_upload_intents
         where asset_id = '60000000-0000-4000-8000-000000000030'
           and operation = 'replace'`,
      ),
    ).toBe("2:failed,3:pending");
  });

  it("persists an owned upload intent and finalizes it exactly once", () => {
    const intentId = "d0000000-0000-4000-8000-000000000001";
    const assetId = "60000000-0000-4000-8000-000000000010";
    const versionId = "70000000-0000-4000-8000-000000000010";
    const path = `${ids.storeB}/${ids.productB}/${assetId}/v1/new-file.pdf`;
    const intent = JSON.parse(
      runSql(
        "upgrade",
        `select to_jsonb(i) from public.create_digital_asset_upload_intent(
          '${intentId}', '${ids.storeB}', '${ids.productB}', '${ids.variantB}',
          '${assetId}', '${versionId}', null, 'New file', 'new-file.pdf',
          'application/pdf', 10, '${path}', 'create', now() + interval '30 minutes'
        ) i`,
      ),
    ) as Record<string, unknown>;
    expect(intent).toMatchObject({
      intent_id: intentId,
      asset_id: assetId,
      asset_version_id: versionId,
      storage_path: path,
      intent_status: "pending",
      version_number: 1,
    });

    const first = JSON.parse(
      runSql(
        "upgrade",
        `select to_jsonb(v) from public.finalize_digital_asset_upload_intent(
          '${intentId}', '${ids.storeB}', 10, 'application/pdf', repeat('9', 64)
        ) v`,
      ),
    ) as Record<string, unknown>;
    const repeated = JSON.parse(
      runSql(
        "upgrade",
        `select to_jsonb(v) from public.finalize_digital_asset_upload_intent(
          '${intentId}', '${ids.storeB}', 10, 'application/pdf', repeat('9', 64)
        ) v`,
      ),
    ) as Record<string, unknown>;
    expect(first).toMatchObject({
      asset_id: assetId,
      asset_version_id: versionId,
      was_already_completed: false,
    });
    expect(repeated).toMatchObject({
      asset_id: assetId,
      asset_version_id: versionId,
      was_already_completed: true,
    });
    expect(
      runSql(
        "upgrade",
        `select count(*) from public.digital_product_asset_versions where id = '${versionId}'`,
      ),
    ).toBe("1");
  });

  it("rejects cross-store and wrong-product variant intents without exposing a writable path", () => {
    expectRejected(
      "upgrade",
      `select * from public.create_digital_asset_upload_intent(
        'd0000000-0000-4000-8000-000000000002', '${ids.storeA}', '${ids.productB}', '${ids.variantB}',
        '60000000-0000-4000-8000-000000000011', '70000000-0000-4000-8000-000000000011',
        null, 'Wrong store', 'wrong.pdf', 'application/pdf', 10,
        '${ids.storeA}/${ids.productB}/60000000-0000-4000-8000-000000000011/v1/wrong.pdf',
        'create', now() + interval '30 minutes'
      )`,
    );
    expectRejected(
      "upgrade",
      `select * from public.create_digital_asset_upload_intent(
        'd0000000-0000-4000-8000-000000000003', '${ids.storeA}', '${ids.productA}', '${ids.variantA2}',
        '60000000-0000-4000-8000-000000000012', '70000000-0000-4000-8000-000000000012',
        null, 'Wrong variant', 'wrong.pdf', 'application/pdf', 10,
        '${ids.storeA}/${ids.productA}/60000000-0000-4000-8000-000000000012/v1/wrong.pdf',
        'create', now() + interval '30 minutes'
      )`,
    );
    expectRejected(
      "upgrade",
      `select * from public.create_digital_asset_upload_intent(
        'd0000000-0000-4000-8000-000000000009', '${ids.storeA}', '${ids.productA}', '${ids.variantA}',
        '60000000-0000-4000-8000-000000000019', '70000000-0000-4000-8000-000000000019',
        null, 'Tampered path', 'safe.pdf', 'application/pdf', 10,
        '${ids.storeB}/${ids.productA}/60000000-0000-4000-8000-000000000019/v1/safe.pdf',
        'create', now() + interval '30 minutes'
      )`,
    );
  });

  it("returns the stable intent contract when retrying a safely failed upload", () => {
    const intentId = "d0000000-0000-4000-8000-000000000005";
    const assetId = "60000000-0000-4000-8000-000000000014";
    runSql(
      "upgrade",
      `select * from public.create_digital_asset_upload_intent(
        '${intentId}', '${ids.storeB}', '${ids.productB}', '${ids.variantB}',
        '${assetId}', '70000000-0000-4000-8000-000000000014', null,
        'Retry file', 'retry.pdf', 'application/pdf', 10,
        '${ids.storeB}/${ids.productB}/${assetId}/v1/retry.pdf',
        'create', now() + interval '30 minutes'
      );
      select public.fail_digital_asset_upload_intent(
        '${ids.storeB}', '${intentId}', 'Stored object verification failed'
      )`,
    );
    expect(
      runSql(
        "upgrade",
        `select (cleanup_after is not null)::text from public.digital_asset_upload_intents
         where id = '${intentId}' and status = 'failed'`,
      ),
    ).toBe("true");
    const retried = JSON.parse(
      runSql(
        "upgrade",
        `select to_jsonb(i) from public.retry_digital_asset_upload_intent(
          '${ids.storeB}', '${intentId}', now() + interval '30 minutes'
        ) i`,
      ),
    ) as Record<string, unknown>;
    expect(retried).toMatchObject({
      intent_id: intentId,
      asset_id: assetId,
      intent_status: "pending",
    });
    expect(retried).not.toHaveProperty("id");
  });

  it("replaces immutably and preserves the exact purchased version", () => {
    const replacementIntent = "d0000000-0000-4000-8000-000000000004";
    const replacementVersion = "70000000-0000-4000-8000-000000000013";
    const intent = JSON.parse(
      runSql(
        "upgrade",
        `select to_jsonb(i) from public.create_digital_asset_upload_intent(
          '${replacementIntent}', '${ids.storeA}', null, null, '${ids.assetA}',
          '${replacementVersion}', '${ids.assetA}', null, 'replacement.pdf',
          'application/pdf', 11, null, 'replace', now() + interval '30 minutes'
        ) i`,
      ),
    ) as Record<string, unknown>;
    expect(intent.version_number).toBe(4);
    runSql(
      "upgrade",
      `select * from public.finalize_digital_asset_upload_intent(
        '${replacementIntent}', '${ids.storeA}', 11, 'application/pdf', repeat('8', 64)
      )`,
    );
    expect(
      runSql(
        "upgrade",
        `select asset_version_id from public.digital_order_entitlements where id = '${ids.entitlementA}'`,
      ),
    ).toBe(ids.versionA);
    expect(
      runSql(
        "upgrade",
        `select count(*) from public.digital_product_asset_versions
         where asset_id = '${ids.assetA}' and id in ('${ids.versionA}', '${replacementVersion}')`,
      ),
    ).toBe("2");
  });

  it("deactivates catalog assets without deleting versions or entitlements", () => {
    const result = JSON.parse(
      runSql(
        "upgrade",
        `select to_jsonb(r) from public.deactivate_digital_product_asset(
          '${ids.storeA}', '${ids.assetA}'
        ) r`,
      ),
    ) as Record<string, unknown>;
    expect(result).toMatchObject({
      deactivated: true,
      entitlement_count: 2,
    });
    expect(
      runSql(
        "upgrade",
        `select active::text from public.digital_product_assets where id = '${ids.assetA}'`,
      ),
    ).toBe("false");
    expect(
      runSql(
        "upgrade",
        `select count(*) from public.digital_order_entitlements where id = '${ids.entitlementA}'`,
      ),
    ).toBe("1");
  });

  it("enforces the active plus pending file limit while holding the product lock", () => {
    runSql(
      "upgrade",
      `insert into public.digital_product_assets(store_id, product_id, product_variant_id, label)
       select '${ids.storeA}', '${ids.productA2}', '${ids.variantA2}', 'Limit ' || value
       from generate_series(1, 19) value`,
    );
    expectRejected(
      "upgrade",
      `select * from public.create_digital_asset_upload_intent(
        'd0000000-0000-4000-8000-000000000006', '${ids.storeA}', '${ids.productA2}', '${ids.variantA2}',
        '60000000-0000-4000-8000-000000000015', '70000000-0000-4000-8000-000000000015',
        null, 'File 21', 'limit.pdf', 'application/pdf', 10,
        '${ids.storeA}/${ids.productA2}/60000000-0000-4000-8000-000000000015/v1/limit.pdf',
        'create', now() + interval '30 minutes'
      )`,
    );
  });

  it("durably expires an elapsed intent without rolling back cleanup state", () => {
    const intentId = "d0000000-0000-4000-8000-000000000020";
    const assetId = "60000000-0000-4000-8000-000000000020";
    const versionId = "70000000-0000-4000-8000-000000000020";
    runSql(
      "upgrade",
      `select * from public.create_digital_asset_upload_intent(
        '${intentId}', '${ids.storeB}', '${ids.productB}', '${ids.variantB}',
        '${assetId}', '${versionId}', null, 'Expires', 'expires.pdf',
        'application/pdf', 10,
        '${ids.storeB}/${ids.productB}/${assetId}/v1/expires.pdf',
        'create', now() + interval '30 minutes'
      );
      update public.digital_asset_upload_intents
      set created_at = now() - interval '2 hours',
          expires_at = now() - interval '1 hour'
      where id = '${intentId}'`,
    );

    expect(
      runSql(
        "upgrade",
        `select public.expire_digital_asset_upload_intent('${ids.storeB}', '${intentId}')::text`,
      ),
    ).toBe("true");
    expect(
      runSql(
        "upgrade",
        `select status || ':' || (cleanup_after <= now())::text
         from public.digital_asset_upload_intents where id = '${intentId}'`,
      ),
    ).toBe("expired:true");
    const finalized = JSON.parse(
      runSql(
        "upgrade",
        `select to_jsonb(result) from public.finalize_digital_asset_upload_intent(
          '${intentId}', '${ids.storeB}', 10, 'application/pdf', repeat('7', 64)
        ) result`,
      ),
    ) as Record<string, unknown>;
    expect(finalized.finalization_status).toBe("expired");
    expect(
      runSql(
        "upgrade",
        `select count(*) from public.digital_product_asset_versions where id = '${versionId}'`,
      ),
    ).toBe("0");
  });

  it("leases one preview processor and rejects stale completion and failure after override", () => {
    const first = JSON.parse(
      runSql(
        "upgrade",
        `select to_jsonb(result) from public.begin_digital_product_preview(
          '${ids.storeA}', '${ids.productA2}', '${ids.versionA2}'
        ) result`,
      ),
    ) as Record<string, unknown>;
    expect(first).toMatchObject({
      preview_status: "processing",
      processing_acquired: true,
    });
    const generation = String(first.processing_generation);
    expect(generation).toMatch(/^[a-f0-9-]{36}$/);

    const concurrent = JSON.parse(
      runSql(
        "upgrade",
        `select to_jsonb(result) from public.begin_digital_product_preview(
          '${ids.storeA}', '${ids.productA2}', '${ids.versionA2}'
        ) result`,
      ),
    ) as Record<string, unknown>;
    expect(concurrent).toMatchObject({
      preview_status: "processing",
      processing_acquired: false,
      processing_generation: null,
    });

    const overridePath = `${ids.storeA}/${ids.productA2}/merchant-override-${"a".repeat(64)}.jpg`;
    runSql(
      "upgrade",
      `select public.complete_digital_preview_override(
        '${ids.storeA}', '${ids.productA2}', '${overridePath}'
      )`,
    );
    expect(
      runSql(
        "upgrade",
        `select public.complete_digital_product_preview(
          '${ids.storeA}', '${ids.productA2}', '${ids.versionA2}',
          '${ids.storeA}/${ids.productA2}/watermarked-${ids.versionA2}-${generation}.jpg',
          '${generation}'
        )::text`,
      ),
    ).toBe("false");
    expect(
      runSql(
        "upgrade",
        `select public.fail_digital_product_preview(
          '${ids.storeA}', '${ids.productA2}', '${generation}', 'Stale worker failed'
        )::text`,
      ),
    ).toBe("false");
    expect(
      runSql(
        "upgrade",
        `select status || ':' || is_merchant_override::text || ':' || public_preview_path
         from public.digital_product_previews
         where product_id = '${ids.productA2}'`,
      ),
    ).toBe(`ready:true:${overridePath}`);
  });

  it("persists only the renewed preview generation after a processing lease expires", () => {
    const stale = JSON.parse(
      runSql(
        "upgrade",
        `select to_jsonb(result) from public.begin_digital_product_preview(
          '${ids.storeA}', '${ids.productA2}', '${ids.versionA2}'
        ) result`,
      ),
    ) as Record<string, unknown>;
    const staleGeneration = String(stale.processing_generation);
    expect(stale.processing_acquired).toBe(true);

    runSql(
      "upgrade",
      `update public.digital_product_previews
       set processing_lease_expires_at = now() - interval '1 second'
       where product_id = '${ids.productA2}'`,
    );
    const winner = JSON.parse(
      runSql(
        "upgrade",
        `select to_jsonb(result) from public.begin_digital_product_preview(
          '${ids.storeA}', '${ids.productA2}', '${ids.versionA2}'
        ) result`,
      ),
    ) as Record<string, unknown>;
    const winningGeneration = String(winner.processing_generation);
    const stalePath = `${ids.storeA}/${ids.productA2}/watermarked-${ids.versionA2}-${staleGeneration}.jpg`;
    const winningPath = `${ids.storeA}/${ids.productA2}/watermarked-${ids.versionA2}-${winningGeneration}.jpg`;
    expect(winner.processing_acquired).toBe(true);
    expect(winningGeneration).not.toBe(staleGeneration);

    expect(
      runSql(
        "upgrade",
        `select public.complete_digital_product_preview(
          '${ids.storeA}', '${ids.productA2}', '${ids.versionA2}',
          '${winningPath}', '${winningGeneration}'
        )::text`,
      ),
    ).toBe("true");
    expect(
      runSql(
        "upgrade",
        `select public.complete_digital_product_preview(
          '${ids.storeA}', '${ids.productA2}', '${ids.versionA2}',
          '${stalePath}', '${staleGeneration}'
        )::text`,
      ),
    ).toBe("false");
    expect(
      runSql(
        "upgrade",
        `select public_preview_path from public.digital_product_previews
         where product_id = '${ids.productA2}'`,
      ),
    ).toBe(winningPath);
  });

  it("rejects a preview path that does not match the completing generation", () => {
    const begun = JSON.parse(
      runSql(
        "upgrade",
        `select to_jsonb(result) from public.begin_digital_product_preview(
          '${ids.storeB}', '${ids.productB}', '${ids.versionB}'
        ) result`,
      ),
    ) as Record<string, unknown>;
    const generation = String(begun.processing_generation);
    const foreignGeneration = "a0000000-0000-4000-8000-000000000099";
    const mismatchedPath = `${ids.storeB}/${ids.productB}/watermarked-${ids.versionB}-${foreignGeneration}.jpg`;

    expectRejected(
      "upgrade",
      `select public.complete_digital_product_preview(
        '${ids.storeB}', '${ids.productB}', '${ids.versionB}',
        '${mismatchedPath}', '${generation}'
      )`,
    );
    expect(
      runSql(
        "upgrade",
        `select status || ':' || coalesce(public_preview_path, 'none') || ':' || processing_generation::text
         from public.digital_product_previews where product_id = '${ids.productB}'`,
      ),
    ).toBe(`processing:none:${generation}`);
  });

  it("prevents overlapping replacements and stale older finalization from regressing current version", () => {
    const olderIntent = "d0000000-0000-4000-8000-000000000021";
    const olderVersion = "70000000-0000-4000-8000-000000000021";
    const newerIntent = "d0000000-0000-4000-8000-000000000022";
    const newerVersion = "70000000-0000-4000-8000-000000000022";
    runSql(
      "upgrade",
      `select * from public.create_digital_asset_upload_intent(
        '${olderIntent}', '${ids.storeB}', null, null, '${ids.assetB}',
        '${olderVersion}', '${ids.assetB}', null, 'older.pdf',
        'application/pdf', 10, null, 'replace', now() + interval '30 minutes'
      )`,
    );
    expectRejected(
      "upgrade",
      `select * from public.create_digital_asset_upload_intent(
        '${newerIntent}', '${ids.storeB}', null, null, '${ids.assetB}',
        '${newerVersion}', '${ids.assetB}', null, 'newer.pdf',
        'application/pdf', 10, null, 'replace', now() + interval '30 minutes'
      )`,
    );

    runSql(
      "upgrade",
      `select public.fail_digital_asset_upload_intent(
        '${ids.storeB}', '${olderIntent}', 'Replacement superseded'
      );
      select * from public.create_digital_asset_upload_intent(
        '${newerIntent}', '${ids.storeB}', null, null, '${ids.assetB}',
        '${newerVersion}', '${ids.assetB}', null, 'newer.pdf',
        'application/pdf', 10, null, 'replace', now() + interval '30 minutes'
      );
      select * from public.finalize_digital_asset_upload_intent(
        '${newerIntent}', '${ids.storeB}', 10, 'application/pdf', repeat('6', 64)
      )`,
    );
    expectRejected(
      "upgrade",
      `select * from public.retry_digital_asset_upload_intent(
        '${ids.storeB}', '${olderIntent}', now() + interval '30 minutes'
      )`,
    );
    expectRejected(
      "upgrade",
      `select * from public.finalize_digital_asset_upload_intent(
        '${olderIntent}', '${ids.storeB}', 10, 'application/pdf', repeat('5', 64)
      )`,
    );
    expect(
      runSql(
        "upgrade",
        `select id from public.digital_product_asset_versions
         where asset_id = '${ids.assetB}' and retired_at is null`,
      ),
    ).toBe(newerVersion);
    expect(
      runSql(
        "upgrade",
        `select count(*) from public.digital_product_asset_versions where id = '${olderVersion}'`,
      ),
    ).toBe("0");
  });
});

describe("transactional digital product publishing", () => {
  const publishingIds = {
    user: "01000000-0000-4000-8000-000000000001",
    store: "11000000-0000-4000-8000-000000000001",
    product: "21000000-0000-4000-8000-000000000001",
    secondProduct: "21000000-0000-4000-8000-000000000002",
    variantOne: "31000000-0000-4000-8000-000000000001",
    variantTwo: "31000000-0000-4000-8000-000000000002",
    assetOne: "61000000-0000-4000-8000-000000000001",
    assetTwo: "61000000-0000-4000-8000-000000000002",
    secondProductAsset: "61000000-0000-4000-8000-000000000003",
    versionOne: "71000000-0000-4000-8000-000000000001",
    versionTwo: "71000000-0000-4000-8000-000000000002",
  } as const;

  beforeAll(() => {
    runSql(
      "full_chain",
      `insert into auth.users(id, email) values
         ('${publishingIds.user}', 'publisher@example.test');
       insert into public.stores(id, owner_user_id, name, slug, status) values
         ('${publishingIds.store}', '${publishingIds.user}', 'Publishing Test', 'publishing-test', 'live');
       insert into public.products(
         id, store_id, title, description, slug, sku, price_cents,
         inventory_qty, status, product_type, digital_rights_affirmed_at,
         digital_rights_affirmed_by_user_id
       ) values
         ('${publishingIds.product}', '${publishingIds.store}', 'Digital bundle', 'Files',
          'digital-bundle', null, 1200, 0, 'draft', 'digital', now(), '${publishingIds.user}'),
         ('${publishingIds.secondProduct}', '${publishingIds.store}', 'Physical print', 'Print',
          'physical-print', 'PHYSICAL-PRINT', 2200, 4, 'draft', 'physical', null, null);
       insert into public.product_variants(
         id, store_id, product_id, title, sku, sku_mode, image_urls,
         group_image_urls, option_values, price_cents, inventory_qty,
         is_made_to_order, is_default, status, sort_order
       ) values
         ('${publishingIds.variantOne}', '${publishingIds.store}', '${publishingIds.product}',
          'Blue', 'DIGITAL-BLUE', 'manual', '{}', '{}', '{"Color":"Blue"}', 1200, 0,
          false, true, 'active', 0),
         ('${publishingIds.variantTwo}', '${publishingIds.store}', '${publishingIds.product}',
          'Red', 'DIGITAL-RED', 'manual', '{}', '{}', '{"Color":"Red"}', 1200, 0,
          false, false, 'active', 1);
       insert into public.digital_product_assets(
         id, store_id, product_id, product_variant_id, label, active
       ) values
         ('${publishingIds.assetOne}', '${publishingIds.store}', '${publishingIds.product}',
          '${publishingIds.variantOne}', 'Blue file', true),
         ('${publishingIds.assetTwo}', '${publishingIds.store}', '${publishingIds.product}',
          '${publishingIds.variantTwo}', 'Red processing file', true);
       insert into public.digital_product_asset_versions(
         id, asset_id, product_id, store_id, version_number, storage_path,
         customer_filename, mime_type, byte_size, checksum_sha256, status
       ) values
         ('${publishingIds.versionOne}', '${publishingIds.assetOne}', '${publishingIds.product}',
          '${publishingIds.store}', 1,
          '${publishingIds.store}/${publishingIds.product}/${publishingIds.assetOne}/v1/blue.pdf',
          'blue.pdf', 'application/pdf', 10, repeat('a', 64), 'ready'),
         ('${publishingIds.versionTwo}', '${publishingIds.assetTwo}', '${publishingIds.product}',
          '${publishingIds.store}', 1,
          '${publishingIds.store}/${publishingIds.product}/${publishingIds.assetTwo}/v1/red.pdf',
          'red.pdf', 'application/pdf', 10, repeat('b', 64), 'processing');
       insert into public.digital_product_previews(
         product_id, store_id, public_preview_path, status, is_merchant_override
       ) values (
         '${publishingIds.product}', '${publishingIds.store}',
         '${publishingIds.store}/${publishingIds.product}/merchant-override-${"c".repeat(64)}.jpg',
         'ready', true
       );`,
    );
  });

  function prepareRelationMoveFixture() {
    runSql(
      "full_chain",
      `update public.products
       set status = 'draft'
       where id = '${publishingIds.product}';
       update public.products
       set product_type = 'digital',
           digital_rights_affirmed_at = now(),
           digital_rights_affirmed_by_user_id = '${publishingIds.user}'
       where id = '${publishingIds.secondProduct}';
       update public.product_variants
       set status = 'archived'
       where product_id = '${publishingIds.product}';
       update public.digital_product_assets
       set product_variant_id = null, active = true
       where id = '${publishingIds.assetOne}';
       update public.digital_product_asset_versions
       set asset_id = '${publishingIds.assetOne}',
           storage_path = '${publishingIds.store}/${publishingIds.product}/${publishingIds.assetOne}/v1/blue.pdf',
           status = 'ready', retired_at = null
       where id = '${publishingIds.versionOne}';
       update public.digital_product_previews
       set product_id = '${publishingIds.product}',
           public_preview_path = '${publishingIds.store}/${publishingIds.product}/merchant-override-${"c".repeat(64)}.jpg',
           status = 'ready'
       where product_id in ('${publishingIds.product}', '${publishingIds.secondProduct}');
       update public.products
       set status = 'active'
       where id = '${publishingIds.product}';`,
    );
  }

  it("rejects an uncovered proposed variant before changing product, variants, or option metadata", () => {
    const proposedVariants = JSON.stringify([
      {
        id: publishingIds.variantOne,
        title: "Blue changed",
        sku: "DIGITAL-BLUE",
        sku_mode: "manual",
        image_urls: [],
        group_image_urls: [],
        option_values: { Color: "Blue" },
        price_cents: 1200,
        inventory_qty: 0,
        is_made_to_order: false,
        is_default: true,
        status: "active",
        sort_order: 0,
      },
      {
        id: publishingIds.variantTwo,
        title: "Red",
        sku: "DIGITAL-RED",
        sku_mode: "manual",
        image_urls: [],
        group_image_urls: [],
        option_values: { Color: "Red" },
        price_cents: 1200,
        inventory_qty: 0,
        is_made_to_order: false,
        is_default: false,
        status: "active",
        sort_order: 1,
      },
    ]).replaceAll("'", "''");
    const result = JSON.parse(
      runSql(
        "full_chain",
        `select public.apply_digital_product_catalog_update(
          '${publishingIds.store}', '${publishingIds.product}', '${publishingIds.user}',
          '{"status":"active","title":"Mutated title"}'::jsonb,
          '${proposedVariants}'::jsonb, '["Color"]'::jsonb
        )::text`,
      ),
    ) as { applied: boolean; code: string; reasons: string[] };

    expect(result).toEqual({
      applied: false,
      code: "digital_product_not_ready",
      reasons: [`variant_missing_file:${publishingIds.variantTwo}`],
    });
    expect(
      runSql(
        "full_chain",
        `select p.status || ':' || p.title || ':' || pv.title || ':' ||
          (select count(*) from public.product_option_axes a where a.product_id = p.id)::text
         from public.products p
         join public.product_variants pv on pv.id = '${publishingIds.variantOne}'
         where p.id = '${publishingIds.product}'`,
      ),
    ).toBe("draft:Digital bundle:Blue:0");
  });

  it("publishes when every active variant has an applicable ready version", () => {
    runSql(
      "full_chain",
      `update public.digital_product_asset_versions
       set status = 'ready', upload_completed_at = coalesce(upload_completed_at, now())
       where id = '${publishingIds.versionTwo}'`,
    );

    const result = JSON.parse(
      runSql(
        "full_chain",
        `select public.apply_digital_product_catalog_update(
          '${publishingIds.store}', '${publishingIds.product}', '${publishingIds.user}',
          '{"status":"active"}'::jsonb, null, null
        )::text`,
      ),
    ) as { applied: boolean; reasons: string[] };

    expect(result).toEqual({ applied: true, code: "applied", reasons: [] });
    expect(
      runSql(
        "full_chain",
        `select status from public.products where id = '${publishingIds.product}'`,
      ),
    ).toBe("active");
  });

  it("rejects later catalog changes that would make an active digital product undeliverable", () => {
    expectRejected(
      "full_chain",
      `update public.digital_product_asset_versions
       set status = 'processing'
       where id = '${publishingIds.versionTwo}'`,
    );
    expectRejected(
      "full_chain",
      `update public.digital_product_assets
       set active = false
       where id = '${publishingIds.assetOne}'`,
    );
    expectRejected(
      "full_chain",
      `update public.digital_product_previews
       set status = 'failed', public_preview_path = null, failure_reason = 'Preview failed'
       where product_id = '${publishingIds.product}'`,
    );
    expect(
      runSql(
        "full_chain",
        `select
          (select status from public.digital_product_asset_versions where id = '${publishingIds.versionTwo}') || ':' ||
          (select active::text from public.digital_product_assets where id = '${publishingIds.assetOne}') || ':' ||
          (select status from public.digital_product_previews where product_id = '${publishingIds.product}')`,
      ),
    ).toBe("ready:true:ready");
  });

  it("rolls back earlier variant and metadata work when a later product constraint fails", () => {
    const proposedVariants = JSON.stringify([
      {
        id: publishingIds.variantOne,
        title: "Should roll back",
        sku: "DIGITAL-BLUE",
        sku_mode: "manual",
        image_urls: [],
        group_image_urls: [],
        option_values: { Color: "Azure" },
        price_cents: 1200,
        inventory_qty: 0,
        is_made_to_order: false,
        is_default: true,
        status: "active",
        sort_order: 0,
      },
      {
        id: publishingIds.variantTwo,
        title: "Red",
        sku: "DIGITAL-RED",
        sku_mode: "manual",
        image_urls: [],
        group_image_urls: [],
        option_values: { Color: "Red" },
        price_cents: 1200,
        inventory_qty: 0,
        is_made_to_order: false,
        is_default: false,
        status: "active",
        sort_order: 1,
      },
    ]).replaceAll("'", "''");

    expectRejected(
      "full_chain",
      `select public.apply_digital_product_catalog_update(
        '${publishingIds.store}', '${publishingIds.product}', '${publishingIds.user}',
        '{"slug":"physical-print"}'::jsonb,
        '${proposedVariants}'::jsonb, '["Color"]'::jsonb
      )`,
    );
    expect(
      runSql(
        "full_chain",
        `select title || ':' || (option_values->>'Color')
         from public.product_variants where id = '${publishingIds.variantOne}'`,
      ),
    ).toBe("Blue:Blue");
  });

  it("blocks fulfillment conversion with order history and requires fresh rights after a round trip", () => {
    runSql(
      "full_chain",
      `insert into public.orders(
         id, store_id, customer_email, currency, subtotal_cents, total_cents, status
       ) values (
         '41000000-0000-4000-8000-000000000001', '${publishingIds.store}',
         'buyer@example.test', 'usd', 1200, 1200, 'paid'
       );
       insert into public.order_items(
         id, order_id, store_id, product_id, product_variant_id, quantity,
         unit_price_cents, product_type
       ) values (
         '51000000-0000-4000-8000-000000000001',
         '41000000-0000-4000-8000-000000000001', '${publishingIds.store}',
         '${publishingIds.product}', '${publishingIds.variantOne}', 1, 1200, 'digital'
       );`,
    );
    expectRejected(
      "full_chain",
      `update public.products set product_type = 'physical'
       where id = '${publishingIds.product}'`,
    );
    const blocked = JSON.parse(
      runSql(
        "full_chain",
        `select public.apply_digital_product_catalog_update(
          '${publishingIds.store}', '${publishingIds.product}', '${publishingIds.user}',
          '{"product_type":"physical"}'::jsonb, null, null
        )::text`,
      ),
    ) as { applied: boolean; code: string; reasons: string[] };
    expect(blocked).toEqual({
      applied: false,
      code: "product_type_has_order_history",
      reasons: [],
    });

    const toDigitalWithoutRights = JSON.parse(
      runSql(
        "full_chain",
        `select public.apply_digital_product_catalog_update(
          '${publishingIds.store}', '${publishingIds.secondProduct}', '${publishingIds.user}',
          '{"product_type":"digital"}'::jsonb, null, null
        )::text`,
      ),
    ) as { applied: boolean; code: string; reasons: string[] };
    expect(toDigitalWithoutRights).toEqual({
      applied: false,
      code: "fresh_rights_affirmation_required",
      reasons: ["rights_missing"],
    });

    expect(
      JSON.parse(
        runSql(
          "full_chain",
          `select public.apply_digital_product_catalog_update(
            '${publishingIds.store}', '${publishingIds.secondProduct}', '${publishingIds.user}',
            '{"product_type":"digital","digital_rights_affirmed_at":"2026-08-12T12:00:00.000Z","digital_rights_affirmed_by_user_id":"${publishingIds.user}"}'::jsonb,
            null, null
          )::text`,
        ),
      ),
    ).toEqual({ applied: true, code: "applied", reasons: [] });
    expect(
      JSON.parse(
        runSql(
          "full_chain",
          `select public.apply_digital_product_catalog_update(
            '${publishingIds.store}', '${publishingIds.secondProduct}', '${publishingIds.user}',
            '{"product_type":"physical"}'::jsonb, null, null
          )::text`,
        ),
      ),
    ).toEqual({ applied: true, code: "applied", reasons: [] });
    expect(
      runSql(
        "full_chain",
        `select product_type || ':' || (digital_rights_affirmed_at is null)::text || ':' ||
          (digital_rights_affirmed_by_user_id is null)::text
         from public.products where id = '${publishingIds.secondProduct}'`,
      ),
    ).toBe("physical:true:true");

    const secondAttemptWithoutFreshRights = JSON.parse(
      runSql(
        "full_chain",
        `select public.apply_digital_product_catalog_update(
          '${publishingIds.store}', '${publishingIds.secondProduct}', '${publishingIds.user}',
          '{"product_type":"digital"}'::jsonb, null, null
        )::text`,
      ),
    ) as { applied: boolean; code: string; reasons: string[] };
    expect(secondAttemptWithoutFreshRights).toEqual({
      applied: false,
      code: "fresh_rights_affirmation_required",
      reasons: ["rights_missing"],
    });
  });

  it("keeps the mutation service-role-only and returns neutral cross-tenant denial", () => {
    expect(
      runSql(
        "full_chain",
        `select
          has_function_privilege('anon', 'public.apply_digital_product_catalog_update(uuid,uuid,uuid,jsonb,jsonb,jsonb)', 'execute')::text || ':' ||
          has_function_privilege('authenticated', 'public.apply_digital_product_catalog_update(uuid,uuid,uuid,jsonb,jsonb,jsonb)', 'execute')::text || ':' ||
          has_function_privilege('service_role', 'public.apply_digital_product_catalog_update(uuid,uuid,uuid,jsonb,jsonb,jsonb)', 'execute')::text`,
      ),
    ).toBe("false:false:true");
    expect(
      runSql(
        "full_chain",
        `select
          has_function_privilege('anon', 'public.acquire_digital_readiness_mutation_lock()', 'execute')::text || ':' ||
          has_function_privilege('authenticated', 'public.acquire_digital_readiness_mutation_lock()', 'execute')::text || ':' ||
          has_function_privilege('service_role', 'public.acquire_digital_readiness_mutation_lock()', 'execute')::text`,
      ),
    ).toBe("false:false:false");
    expect(
      JSON.parse(
        runSql(
          "full_chain",
          `select public.apply_digital_product_catalog_update(
            '11000000-0000-4000-8000-000000000099', '${publishingIds.product}', '${publishingIds.user}',
            '{"title":"Forbidden"}'::jsonb, null, null
          )::text`,
        ),
      ),
    ).toEqual({ applied: false, code: "product_unavailable", reasons: [] });
    expect(
      JSON.parse(
        runSql(
          "full_chain",
          `select public.apply_digital_product_catalog_update(
            '${publishingIds.store}', '${publishingIds.product}',
            '01000000-0000-4000-8000-000000000099',
            '{"title":"Forbidden"}'::jsonb, null, null
          )::text`,
        ),
      ),
    ).toEqual({ applied: false, code: "product_unavailable", reasons: [] });
  });

  it("serializes publishing against a concurrent update of the sole ready version", async () => {
    runSql(
      "full_chain",
      `update public.products set status = 'draft'
       where id = '${publishingIds.product}';
       update public.product_variants set status = 'archived'
       where id = '${publishingIds.variantTwo}';
       update public.digital_product_asset_versions set status = 'ready'
       where id = '${publishingIds.versionOne}';`,
    );

    const versionMutation = runSqlAsync(
      "full_chain",
      `begin;
       update public.digital_product_asset_versions set status = 'processing'
       where id = '${publishingIds.versionOne}';
       set constraints enforce_active_digital_product_readiness immediate;
       select pg_sleep(1.5);
       commit;`,
      "digital-readiness-version-race",
    );
    await waitForPostgresSession("full_chain", "digital-readiness-version-race");

    const publish = runSqlAsync(
      "full_chain",
      `select public.apply_digital_product_catalog_update(
        '${publishingIds.store}', '${publishingIds.product}', '${publishingIds.user}',
        '{"status":"active"}'::jsonb, null, null
      )::text`,
      "digital-readiness-publish-race",
    );

    const [versionResult, publishResult] = await Promise.all([
      versionMutation,
      publish,
    ]);
    expect(versionResult).toBe("");
    expect(JSON.parse(publishResult)).toEqual({
      applied: false,
      code: "digital_product_not_ready",
      reasons: [`variant_missing_file:${publishingIds.variantOne}`],
    });
    expect(
      runSql(
        "full_chain",
        `select p.status || ':' || v.status
         from public.products p
         join public.digital_product_asset_versions v
           on v.id = '${publishingIds.versionOne}'
         where p.id = '${publishingIds.product}'`,
      ),
    ).toBe("draft:processing");
  });

  it("serializes catalog variant writes with direct variant updates without deadlocking", async () => {
    const proposedVariants = JSON.stringify([
      {
        id: publishingIds.variantOne,
        title: "Catalog wins after serialization",
        sku: "DIGITAL-BLUE",
        sku_mode: "manual",
        image_urls: [],
        group_image_urls: [],
        option_values: { Color: "Blue" },
        price_cents: 1200,
        inventory_qty: 0,
        is_made_to_order: false,
        is_default: true,
        status: "active",
        sort_order: 0,
      },
      {
        id: publishingIds.variantTwo,
        title: "Red",
        sku: "DIGITAL-RED",
        sku_mode: "manual",
        image_urls: [],
        group_image_urls: [],
        option_values: { Color: "Red" },
        price_cents: 1200,
        inventory_qty: 0,
        is_made_to_order: false,
        is_default: false,
        status: "archived",
        sort_order: 1,
      },
    ]).replaceAll("'", "''");

    const catalogUpdate = runSqlAsync(
      "full_chain",
      `begin;
       set local deadlock_timeout = '100ms';
       set local lock_timeout = '5s';
       do $catalog$
       begin
         perform pg_advisory_xact_lock(
           hashtextextended('myrivo:digital-product-readiness:v1', 0)
         );
         perform 1 from public.products
         where id = '${publishingIds.product}'
         for update;
       end;
       $catalog$;
       select pg_sleep(1.5);
       select public.apply_digital_product_catalog_update(
         '${publishingIds.store}', '${publishingIds.product}', '${publishingIds.user}',
         '{}'::jsonb, '${proposedVariants}'::jsonb, '["Color"]'::jsonb
       )::text;
       commit;`,
      "digital-readiness-catalog-variant-race",
    );
    await waitForPostgresSession(
      "full_chain",
      "digital-readiness-catalog-variant-race",
    );

    const directVariantUpdate = runSqlAsync(
      "full_chain",
      `begin;
       set local deadlock_timeout = '100ms';
       set local lock_timeout = '5s';
       update public.product_variants
       set status = 'archived'
       where id = '${publishingIds.variantOne}';
       commit;`,
      "digital-readiness-direct-variant-race",
    );
    await waitForPostgresLock(
      "full_chain",
      "digital-readiness-direct-variant-race",
    );

    const [catalogResult, directResult] = await Promise.all([
      catalogUpdate,
      directVariantUpdate,
    ]);
    expect(directResult).toBe("");
    expect(JSON.parse(catalogResult)).toEqual({
      applied: true,
      code: "applied",
      reasons: [],
    });
    expect(
      runSql(
        "full_chain",
        `select p.status || ':' || v.status || ':' || v.title
         from public.products p
         join public.product_variants v on v.product_id = p.id
         where p.id = '${publishingIds.product}'
           and v.id = '${publishingIds.variantOne}'`,
      ),
    ).toBe("draft:archived:Catalog wins after serialization");
  });

  it("rejects moving the sole ready preview away from an active digital product", () => {
    prepareRelationMoveFixture();

    expectRejected(
      "full_chain",
      `begin;
       update public.digital_product_previews
       set product_id = '${publishingIds.secondProduct}',
           public_preview_path = '${publishingIds.store}/${publishingIds.secondProduct}/merchant-override-${"d".repeat(64)}.jpg'
       where product_id = '${publishingIds.product}';
       set constraints enforce_active_digital_product_readiness immediate;
       rollback;`,
    );
    expect(
      runSql(
        "full_chain",
        `select p.status || ':' || preview.product_id::text
         from public.products p
         join public.digital_product_previews preview on preview.product_id = p.id
         where p.id = '${publishingIds.product}'`,
      ),
    ).toBe(`active:${publishingIds.product}`);
  });

  it("rejects moving the sole ready asset version away from an active digital product", () => {
    prepareRelationMoveFixture();
    runSql(
      "full_chain",
      `insert into public.digital_product_assets(
         id, store_id, product_id, product_variant_id, label, active
       ) values (
         '${publishingIds.secondProductAsset}', '${publishingIds.store}',
         '${publishingIds.secondProduct}', null, 'Destination asset', true
       ) on conflict (id) do nothing;`,
    );

    expectRejected(
      "full_chain",
      `begin;
       update public.digital_product_asset_versions
       set asset_id = '${publishingIds.secondProductAsset}',
           storage_path = '${publishingIds.store}/${publishingIds.secondProduct}/${publishingIds.secondProductAsset}/v1/blue.pdf'
       where id = '${publishingIds.versionOne}';
       set constraints enforce_active_digital_product_readiness immediate;
       rollback;`,
    );
    expect(
      runSql(
        "full_chain",
        `select p.status || ':' || version.asset_id::text || ':' || version.product_id::text
         from public.products p
         join public.digital_product_asset_versions version on version.product_id = p.id
         where p.id = '${publishingIds.product}'
           and version.id = '${publishingIds.versionOne}'`,
      ),
    ).toBe(
      `active:${publishingIds.assetOne}:${publishingIds.product}`,
    );
  });
});
