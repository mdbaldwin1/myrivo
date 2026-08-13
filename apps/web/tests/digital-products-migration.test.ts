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
        "select public.digital_asset_max_active_files()::text || ':' || public.digital_asset_max_file_bytes()::text || ':' || extract(epoch from public.digital_asset_max_intent_ttl())::bigint::text",
      ),
    ).toBe(
      `${DIGITAL_PRODUCT_CONFIG.maxFilesPerProduct}:${DIGITAL_PRODUCT_CONFIG.maxFileBytes}:${DIGITAL_PRODUCT_CONFIG.maxUploadIntentTtlSeconds}`,
    );
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
});
