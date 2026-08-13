import { execFileSync } from "node:child_process";
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
  owner_user_id uuid not null references auth.users(id)
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
  customer_email text not null default 'customer@example.test'
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
    applyMigration("full_chain", join(migrationsDirectory, migration));
  }
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
});
