import { execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const prototypeMigration = join(
  repoRoot,
  "supabase/migrations/20260812170000_native_digital_products.sql",
);
const hardeningMigration = join(
  repoRoot,
  "supabase/migrations/20260812180000_harden_digital_products.sql",
);
const grantMigration = join(
  repoRoot,
  "supabase/migrations/20260813010000_atomic_digital_download_grants.sql",
);
const grantHardeningMigration = join(
  repoRoot,
  "supabase/migrations/20260813011000_harden_atomic_digital_download_grants.sql",
);

const ids = {
  owner: "00000000-0000-4000-8000-000000000901",
  store: "10000000-0000-4000-8000-000000000901",
  product: "20000000-0000-4000-8000-000000000901",
  variant: "30000000-0000-4000-8000-000000000901",
  order: "40000000-0000-4000-8000-000000000901",
  otherOrder: "40000000-0000-4000-8000-000000000902",
  item: "50000000-0000-4000-8000-000000000901",
  otherItem: "50000000-0000-4000-8000-000000000902",
  asset: "60000000-0000-4000-8000-000000000901",
  version: "70000000-0000-4000-8000-000000000901",
  entitlement: "80000000-0000-4000-8000-000000000901",
  token: "90000000-0000-4000-8000-000000000901",
  otherToken: "90000000-0000-4000-8000-000000000902",
} as const;

const fingerprintA = "a".repeat(64);
const fingerprintB = "b".repeat(64);
const tokenHash = "c".repeat(64);
const otherTokenHash = "d".repeat(64);

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
  status text not null default 'paid',
  total_cents integer not null default 1000
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
create table public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  status text not null check (status in ('requested','processing','succeeded','failed','cancelled'))
);
create table public.order_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  status text not null check (status in (
    'warning_needs_response','warning_under_review','warning_closed',
    'needs_response','under_review','won','lost','prevented'
  ))
);
`;

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
let clusterDirectory = "";
let port = 0;
const database = "grant_contract";
const mismatchDatabase = "grant_upgrade_mismatch";

function postgresEnvironment(databaseName = database) {
  return {
    ...process.env,
    PGDATABASE: databaseName,
    PGHOST: "127.0.0.1",
    PGPORT: String(port),
    PGUSER: "postgres",
  };
}

function runSql(statement: string, databaseName = database) {
  if (!psql) throw new Error("PostgreSQL psql is required");
  return execFileSync(
    psql,
    ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", statement],
    {
      encoding: "utf8",
      env: postgresEnvironment(databaseName),
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();
}

function runSqlAsync(statement: string, applicationName: string) {
  if (!psql) return Promise.reject(new Error("PostgreSQL psql is required"));
  return new Promise<string>((resolvePromise, rejectPromise) => {
    execFile(
      psql,
      ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", statement],
      {
        encoding: "utf8",
        env: { ...postgresEnvironment(), PGAPPNAME: applicationName },
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

async function waitForPostgresSession(applicationName: string) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const waiting = runSql(
      `select count(*) from pg_stat_activity
       where application_name = '${applicationName}'
         and state = 'active'
         and query like '%pg_sleep%'`,
    );
    if (waiting === "1") return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
  throw new Error(
    `PostgreSQL session ${applicationName} did not reach its race barrier`,
  );
}

async function waitForPostgresLock(applicationName: string) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const waiting = runSql(
      `select count(*) from pg_stat_activity
       where application_name = '${applicationName}'
         and state = 'active'
         and wait_event_type = 'Lock'`,
    );
    if (waiting === "1") return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
  throw new Error(
    `PostgreSQL session ${applicationName} did not reach its lock barrier`,
  );
}

function expectRejected(statement: string) {
  expect(() => runSql(statement)).toThrow();
}

function reserve(
  _label: string,
  fingerprint = fingerprintA,
  accessTokenId: string = ids.token,
) {
  const reservationKey = randomUUID();
  return JSON.parse(
    runSql(
      `select to_jsonb(result) from public.reserve_digital_download_grant(
        '${ids.entitlement}', '${accessTokenId}', '${reservationKey}', '${fingerprint}'
      ) result`,
    ),
  ) as Record<string, unknown>;
}

function commit(grantId: string, fingerprint = fingerprintA) {
  return runSql(
    `select public.commit_digital_download_grant('${grantId}', '${fingerprint}')`,
  );
}

beforeAll(() => {
  if (!initdb || !pgCtl || !createdb || !psql) {
    throw new Error(
      "PostgreSQL 17 binaries are required for grant concurrency tests",
    );
  }
  if (!existsSync(grantMigration)) {
    throw new Error(`Missing atomic grant migration: ${grantMigration}`);
  }
  if (!existsSync(grantHardeningMigration)) {
    throw new Error(
      `Missing hardened atomic grant migration: ${grantHardeningMigration}`,
    );
  }
  clusterDirectory = mkdtempSync(join(tmpdir(), "myrivo-download-grants-"));
  port = 58_000 + (process.pid % 6_000);
  execFileSync(
    initdb,
    ["-D", clusterDirectory, "-A", "trust", "-U", "postgres", "--no-locale"],
    { stdio: "ignore" },
  );
  execFileSync(
    pgCtl,
    ["-D", clusterDirectory, "-o", `-F -p ${port} -h 127.0.0.1`, "-w", "start"],
    { stdio: "ignore" },
  );
  for (const databaseName of [database, mismatchDatabase]) {
    execFileSync(createdb, [databaseName], {
      env: {
        ...process.env,
        PGHOST: "127.0.0.1",
        PGPORT: String(port),
        PGUSER: "postgres",
      },
      stdio: "ignore",
    });
  }
  runSql(
    "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;",
  );
  runSql(baseSchema);
  runSql(readFileSync(prototypeMigration, "utf8"));
  runSql(readFileSync(hardeningMigration, "utf8"));
  runSql(readFileSync(grantMigration, "utf8"));
  runSql(readFileSync(grantHardeningMigration, "utf8"));
  runSql(`
    insert into auth.users(id) values ('${ids.owner}');
    insert into public.stores(id, owner_user_id) values ('${ids.store}', '${ids.owner}');
    insert into public.products(id, store_id, product_type) values (
      '${ids.product}', '${ids.store}', 'digital'
    );
    insert into public.product_variants(id, store_id, product_id) values (
      '${ids.variant}', '${ids.store}', '${ids.product}'
    );
    insert into public.orders(id, store_id, status, total_cents) values
      ('${ids.order}', '${ids.store}', 'paid', 1000),
      ('${ids.otherOrder}', '${ids.store}', 'paid', 1000);
    insert into public.order_items(id, order_id, product_id, product_variant_id) values
      ('${ids.item}', '${ids.order}', '${ids.product}', '${ids.variant}'),
      ('${ids.otherItem}', '${ids.otherOrder}', '${ids.product}', '${ids.variant}');
    insert into public.digital_product_assets(
      id, store_id, product_id, product_variant_id, label
    ) values (
      '${ids.asset}', '${ids.store}', '${ids.product}', '${ids.variant}', 'Printable'
    );
    insert into public.digital_product_asset_versions(
      id, asset_id, version_number, storage_path, customer_filename,
      mime_type, byte_size, checksum_sha256, status
    ) values (
      '${ids.version}', '${ids.asset}', 1,
      '${ids.store}/${ids.product}/${ids.asset}/v1/printable.pdf',
      'printable.pdf', 'application/pdf', 1024, repeat('e', 64), 'ready'
    );
  `);

  runSql(baseSchema, mismatchDatabase);
  runSql(readFileSync(prototypeMigration, "utf8"), mismatchDatabase);
  runSql(readFileSync(hardeningMigration, "utf8"), mismatchDatabase);
  runSql(readFileSync(grantMigration, "utf8"), mismatchDatabase);
  runSql(
    `insert into auth.users(id) values ('${ids.owner}');
     insert into public.stores(id, owner_user_id) values ('${ids.store}', '${ids.owner}');
     insert into public.products(id, store_id, product_type) values (
       '${ids.product}', '${ids.store}', 'digital'
     );
     insert into public.product_variants(id, store_id, product_id) values (
       '${ids.variant}', '${ids.store}', '${ids.product}'
     );
     insert into public.orders(id, store_id, status, total_cents) values (
       '${ids.order}', '${ids.store}', 'paid', 1000
     );
     insert into public.order_items(id, order_id, product_id, product_variant_id) values (
       '${ids.item}', '${ids.order}', '${ids.product}', '${ids.variant}'
     );
     insert into public.digital_product_assets(
       id, store_id, product_id, product_variant_id, label
     ) values (
       '${ids.asset}', '${ids.store}', '${ids.product}', '${ids.variant}', 'Printable'
     );
     insert into public.digital_product_asset_versions(
       id, asset_id, version_number, storage_path, customer_filename,
       mime_type, byte_size, checksum_sha256, status
     ) values (
       '${ids.version}', '${ids.asset}', 1,
       '${ids.store}/${ids.product}/${ids.asset}/v1/printable.pdf',
       'printable.pdf', 'application/pdf', 1024, repeat('e', 64), 'ready'
     );
     insert into public.digital_order_entitlements(
       id, store_id, order_id, order_item_id, product_id, product_variant_id,
       asset_id, asset_version_id, customer_filename, mime_type, byte_size,
       license_version, max_download_grants, download_grants_used, status
     ) values (
       '${ids.entitlement}', '${ids.store}', '${ids.order}', '${ids.item}',
       '${ids.product}', '${ids.variant}', '${ids.asset}', '${ids.version}',
       'printable.pdf', 'application/pdf', 1024, 'personal-use-v1', 5, 4, 'active'
     );
     insert into public.digital_order_access_tokens(
       id, order_id, token_hash, issuance_reason, expires_at
     ) values (
       '${ids.token}', '${ids.order}', '${tokenHash}', 'purchase', now() + interval '48 hours'
     );
     insert into public.digital_download_grants(
       store_id, order_id, entitlement_id, access_token_id, reservation_key,
       client_fingerprint_hash, status, reserved_at, reservation_expires_at,
       issued_at, grace_expires_at
     )
     select
       '${ids.store}', '${ids.order}', '${ids.entitlement}', '${ids.token}',
       gen_random_uuid()::text, repeat('a', 64), 'issued',
       now() - interval '2 hours', now() - interval '115 minutes',
       now() - interval '119 minutes', now() - interval '118 minutes'
     from generate_series(1, 5);`,
    mismatchDatabase,
  );
}, 60_000);

beforeEach(() => {
  runSql(`
    delete from public.digital_download_grants;
    delete from public.digital_order_access_tokens;
    delete from public.digital_order_entitlements;
    delete from public.order_refunds;
    delete from public.order_disputes;
    update public.orders set status = 'paid', total_cents = 1000;
    insert into public.digital_order_entitlements(
      id, store_id, order_id, order_item_id, product_id, product_variant_id,
      asset_id, asset_version_id, customer_filename, mime_type, byte_size,
      license_version, max_download_grants, download_grants_used, status
    ) values (
      '${ids.entitlement}', '${ids.store}', '${ids.order}', '${ids.item}',
      '${ids.product}', '${ids.variant}', '${ids.asset}', '${ids.version}',
      'printable.pdf', 'application/pdf', 1024, 'personal-use-v1', 5, 0, 'active'
    );
    insert into public.digital_order_access_tokens(
      id, order_id, token_hash, issuance_reason, expires_at
    ) values
      ('${ids.token}', '${ids.order}', '${tokenHash}', 'purchase', now() + interval '48 hours'),
      ('${ids.otherToken}', '${ids.otherOrder}', '${otherTokenHash}', 'purchase', now() + interval '48 hours');
  `);
});

afterAll(() => {
  if (pgCtl && clusterDirectory) {
    execFileSync(pgCtl, ["-D", clusterDirectory, "-m", "fast", "-w", "stop"], {
      stdio: "ignore",
    });
    rmSync(clusterDirectory, { recursive: true, force: true });
  }
});

describe("atomic digital download grants", () => {
  test("rejects an upgrade with five issued grants but a used counter of four", () => {
    expect(() =>
      runSql(readFileSync(grantHardeningMigration, "utf8"), mismatchDatabase),
    ).toThrow(/grant accounting/i);
    expect(
      runSql(
        `select download_grants_used from public.digital_order_entitlements
         where id = '${ids.entitlement}'`,
        mismatchDatabase,
      ),
    ).toBe("4");
    expect(
      runSql(
        `select count(*) from public.digital_download_grants
         where entitlement_id = '${ids.entitlement}' and status = 'issued'`,
        mismatchDatabase,
      ),
    ).toBe("5");
  });

  test("reuses one issued grant for the same session during 60 seconds", () => {
    const first = reserve("grace-first");
    expect(commit(String(first.grant_id))).toBe("issued");
    const reused = reserve("grace-retry");

    expect(reused.grant_id).toBe(first.grant_id);
    expect(reused.grant_status).toBe("issued");
    expect(
      runSql(
        `select download_grants_used from public.digital_order_entitlements where id = '${ids.entitlement}'`,
      ),
    ).toBe("1");
    expect(
      runSql(
        `select extract(epoch from (grace_expires_at - issued_at))::integer
         from public.digital_download_grants where id = '${String(first.grant_id)}'`,
      ),
    ).toBe("60");
  });

  test("a different session consumes a separate successful grant", () => {
    const first = reserve("session-a", fingerprintA);
    commit(String(first.grant_id), fingerprintA);
    const second = reserve("session-b", fingerprintB);
    commit(String(second.grant_id), fingerprintB);

    expect(second.grant_id).not.toBe(first.grant_id);
    expect(
      runSql(
        `select download_grants_used from public.digital_order_entitlements where id = '${ids.entitlement}'`,
      ),
    ).toBe("2");
  });

  test("a rotated access token does not reuse the revoked token's grace grant", () => {
    const first = reserve("original-token");
    commit(String(first.grant_id));
    runSql(`
      update public.digital_order_access_tokens
      set revoked_at = now()
      where id = '${ids.token}';
      update public.digital_order_access_tokens
      set order_id = '${ids.order}'
      where id = '${ids.otherToken}';
    `);

    const rotated = reserve("rotated-token", fingerprintA, ids.otherToken);
    commit(String(rotated.grant_id), fingerprintA);

    expect(rotated.grant_id).not.toBe(first.grant_id);
    expect(
      runSql(
        `select download_grants_used from public.digital_order_entitlements where id = '${ids.entitlement}'`,
      ),
    ).toBe("2");
  });

  test("the same session consumes a new grant after grace expiry", () => {
    const first = reserve("expired-grace-first");
    commit(String(first.grant_id));
    runSql(
      `update public.digital_download_grants
       set issued_at = now() - interval '120 seconds',
           grace_expires_at = now() - interval '60 seconds'
       where id = '${String(first.grant_id)}'`,
    );
    const second = reserve("expired-grace-second");
    commit(String(second.grant_id));

    expect(second.grant_id).not.toBe(first.grant_id);
    expect(
      runSql(
        `select download_grants_used from public.digital_order_entitlements where id = '${ids.entitlement}'`,
      ),
    ).toBe("2");
  });

  test("rejects a token that expires while reserve waits for database locks", async () => {
    runSql(
      `update public.digital_order_access_tokens
       set expires_at = clock_timestamp() + interval '1 second'
       where id = '${ids.token}'`,
    );
    const holder = runSqlAsync(
      `begin;
       select id from public.digital_order_entitlements
       where id = '${ids.entitlement}' for update;
       select pg_sleep(2);
       commit;`,
      "grant-expiring-token-holder",
    );
    await waitForPostgresSession("grant-expiring-token-holder");
    const reservationKey = randomUUID();
    const reserveAttempt = runSqlAsync(
      `select * from public.reserve_digital_download_grant(
        '${ids.entitlement}', '${ids.token}', '${reservationKey}', '${fingerprintA}'
      )`,
      "grant-expiring-token-reserve",
    );
    await waitForPostgresLock("grant-expiring-token-reserve");

    const [, outcome] = await Promise.allSettled([holder, reserveAttempt]);

    expect(outcome.status).toBe("rejected");
    expect(
      runSql(
        `select count(*) from public.digital_download_grants
         where reservation_key = '${reservationKey}'`,
      ),
    ).toBe("0");
  }, 10_000);

  test("rejects a reservation that expires while commit waits for database locks", async () => {
    const grant = reserve("expiring-reservation");
    runSql(
      `update public.digital_download_grants
       set reservation_expires_at = clock_timestamp() + interval '1 second'
       where id = '${String(grant.grant_id)}'`,
    );
    const holder = runSqlAsync(
      `begin;
       select id from public.digital_download_grants
       where id = '${String(grant.grant_id)}' for update;
       select pg_sleep(2);
       commit;`,
      "grant-expiring-reservation-holder",
    );
    await waitForPostgresSession("grant-expiring-reservation-holder");
    const commitAttempt = runSqlAsync(
      `select public.commit_digital_download_grant(
        '${String(grant.grant_id)}', '${fingerprintA}'
      )`,
      "grant-expiring-reservation-commit",
    );
    await waitForPostgresLock("grant-expiring-reservation-commit");

    const [, outcome] = await Promise.allSettled([holder, commitAttempt]);

    expect(outcome.status).toBe("rejected");
    expect(
      runSql(
        `select download_grants_used from public.digital_order_entitlements
         where id = '${ids.entitlement}'`,
      ),
    ).toBe("0");
    expect(
      runSql(
        `select status from public.digital_download_grants
         where id = '${String(grant.grant_id)}'`,
      ),
    ).toBe("reserved");
  }, 10_000);

  test("does not reuse a grace grant that expires while reserve waits for locks", async () => {
    const issued = reserve("expiring-grace");
    commit(String(issued.grant_id));
    runSql(
      `update public.digital_download_grants
       set grace_expires_at = clock_timestamp() + interval '1 second'
       where id = '${String(issued.grant_id)}'`,
    );
    const holder = runSqlAsync(
      `begin;
       select id from public.digital_order_entitlements
       where id = '${ids.entitlement}' for update;
       select pg_sleep(2);
       commit;`,
      "grant-expiring-grace-holder",
    );
    await waitForPostgresSession("grant-expiring-grace-holder");
    const reservationKey = randomUUID();
    const reserveAttempt = runSqlAsync(
      `select to_jsonb(result) from public.reserve_digital_download_grant(
        '${ids.entitlement}', '${ids.token}', '${reservationKey}', '${fingerprintA}'
      ) result`,
      "grant-expiring-grace-reserve",
    );
    await waitForPostgresLock("grant-expiring-grace-reserve");

    const [, outcome] = await Promise.allSettled([holder, reserveAttempt]);

    expect(outcome.status).toBe("fulfilled");
    const next = JSON.parse(
      outcome.status === "fulfilled" ? outcome.value : "{}",
    ) as Record<string, unknown>;
    expect(next.grant_id).not.toBe(issued.grant_id);
    expect(next.grant_status).toBe("reserved");
    expect(
      runSql(
        `select (next_grant.reserved_at > issued_grant.grace_expires_at)::text
         from public.digital_download_grants next_grant
         cross join public.digital_download_grants issued_grant
         where next_grant.id = '${String(next.grant_id)}'
           and issued_grant.id = '${String(issued.grant_id)}'`,
      ),
    ).toBe("true");
  }, 10_000);

  test("reserve and release never consume while commit consumes exactly once", () => {
    const released = reserve("released-at-signing");
    expect(
      runSql(
        `select public.release_digital_download_grant(
          '${String(released.grant_id)}', '${fingerprintA}', 'Storage signing failed'
        )`,
      ),
    ).toBe("released");
    expect(
      runSql(
        `select download_grants_used from public.digital_order_entitlements where id = '${ids.entitlement}'`,
      ),
    ).toBe("0");

    const issued = reserve("issued-once");
    expect(commit(String(issued.grant_id))).toBe("issued");
    expect(commit(String(issued.grant_id))).toBe("issued");
    expect(
      runSql(
        `select download_grants_used from public.digital_order_entitlements where id = '${ids.entitlement}'`,
      ),
    ).toBe("1");
  });

  test("releases a malformed reserve response only by its complete request identity", () => {
    const reservationKey = randomUUID();
    const grant = JSON.parse(
      runSql(
        `select to_jsonb(result) from public.reserve_digital_download_grant(
          '${ids.entitlement}', '${ids.token}', '${reservationKey}', '${fingerprintA}'
        ) result`,
      ),
    ) as Record<string, unknown>;

    expect(
      runSql(
        `select public.release_digital_download_reservation(
          '${ids.entitlement}', '${ids.token}', '${reservationKey}', '${fingerprintB}',
          'Reservation response invalid'
        )`,
      ),
    ).toBe("missing");
    expect(
      runSql(
        `select status from public.digital_download_grants
         where id = '${String(grant.grant_id)}'`,
      ),
    ).toBe("reserved");
    expect(
      runSql(
        `select public.release_digital_download_reservation(
          '${ids.entitlement}', '${ids.token}', '${reservationKey}', '${fingerprintA}',
          'Reservation response invalid'
        )`,
      ),
    ).toBe("released");
    expect(
      runSql(
        `select status || ':' || last_safe_error
         from public.digital_download_grants
         where id = '${String(grant.grant_id)}'`,
      ),
    ).toBe("released:Reservation response invalid");
  });

  test("enforces counter agreement and rejects a sixth issued grant", () => {
    runSql(`
      update public.digital_order_entitlements
      set download_grants_used = 5
      where id = '${ids.entitlement}';
      insert into public.digital_download_grants(
        store_id, order_id, entitlement_id, access_token_id, reservation_key,
        client_fingerprint_hash, status, reserved_at, reservation_expires_at,
        issued_at, grace_expires_at
      )
      select
        '${ids.store}', '${ids.order}', '${ids.entitlement}', '${ids.token}',
        gen_random_uuid()::text, encode(digest(sequence::text, 'sha256'), 'hex'),
        'issued', now() - interval '2 hours', now() - interval '115 minutes',
        now() - interval '119 minutes', now() - interval '118 minutes'
      from generate_series(1, 5) sequence;
    `);

    expectRejected(
      `update public.digital_order_entitlements
       set download_grants_used = 4
       where id = '${ids.entitlement}'`,
    );
    expectRejected(
      `insert into public.digital_download_grants(
         store_id, order_id, entitlement_id, access_token_id, reservation_key,
         client_fingerprint_hash, status, reserved_at, reservation_expires_at,
         issued_at, grace_expires_at
       ) values (
         '${ids.store}', '${ids.order}', '${ids.entitlement}', '${ids.token}',
         '${randomUUID()}', '${fingerprintA}', 'issued',
         now() - interval '2 hours', now() - interval '115 minutes',
         now() - interval '119 minutes', now() - interval '118 minutes'
       )`,
    );
    expect(
      runSql(
        `select download_grants_used || ':' || (
           select count(*) from public.digital_download_grants grant_row
           where grant_row.entitlement_id = entitlement.id
             and grant_row.status = 'issued'
         )
         from public.digital_order_entitlements entitlement
         where entitlement.id = '${ids.entitlement}'`,
      ),
    ).toBe("5:5");
  });

  test.each(["suspended", "revoked"])("denies a %s entitlement", (status) => {
    runSql(
      `update public.digital_order_entitlements set status = '${status}' where id = '${ids.entitlement}'`,
    );
    expectRejected(
      `select * from public.reserve_digital_download_grant(
          '${ids.entitlement}', '${ids.token}', '${randomUUID()}', '${fingerprintA}'
        )`,
    );
  });

  test("denies expired and revoked access tokens", () => {
    runSql(
      `update public.digital_order_access_tokens
       set created_at = now() - interval '72 hours',
           expires_at = now() - interval '24 hours'
       where id = '${ids.token}'`,
    );
    expectRejected(
      `select * from public.reserve_digital_download_grant(
        '${ids.entitlement}', '${ids.token}', '${randomUUID()}', '${fingerprintA}'
      )`,
    );
    runSql(
      `update public.digital_order_access_tokens
       set expires_at = now() + interval '24 hours', revoked_at = now()
       where id = '${ids.token}'`,
    );
    expectRejected(
      `select * from public.reserve_digital_download_grant(
        '${ids.entitlement}', '${ids.token}', '${randomUUID()}', '${fingerprintA}'
      )`,
    );
  });

  test("denies an otherwise valid token bound to another order", () => {
    expectRejected(
      `select * from public.reserve_digital_download_grant(
        '${ids.entitlement}', '${ids.otherToken}', '${randomUUID()}', '${fingerprintA}'
      )`,
    );
  });

  test("denies a full refund while preserving partial-refund access", () => {
    runSql(
      `insert into public.order_refunds(order_id, store_id, amount_cents, status)
       values ('${ids.order}', '${ids.store}', 400, 'succeeded')`,
    );
    const partial = reserve("partial-refund");
    runSql(
      `select public.release_digital_download_grant(
        '${String(partial.grant_id)}', '${fingerprintA}', 'Test cleanup'
      )`,
    );
    runSql(
      `insert into public.order_refunds(order_id, store_id, amount_cents, status)
       values ('${ids.order}', '${ids.store}', 600, 'succeeded')`,
    );
    expectRejected(
      `select * from public.reserve_digital_download_grant(
        '${ids.entitlement}', '${ids.token}', '${randomUUID()}', '${fingerprintA}'
      )`,
    );
  });

  test.each([
    "warning_needs_response",
    "warning_under_review",
    "needs_response",
    "under_review",
    "lost",
  ])("denies dispute status %s", (status) => {
    runSql(
      `insert into public.order_disputes(order_id, store_id, status)
       values ('${ids.order}', '${ids.store}', '${status}')`,
    );
    expectRejected(
      `select * from public.reserve_digital_download_grant(
        '${ids.entitlement}', '${ids.token}', '${randomUUID()}', '${fingerprintA}'
      )`,
    );
  });

  test.each(["warning_closed", "won", "prevented"])(
    "allows resolved dispute status %s when entitlement remains active",
    (status) => {
      runSql(
        `insert into public.order_disputes(order_id, store_id, status)
         values ('${ids.order}', '${ids.store}', '${status}')`,
      );
      expect(reserve(`resolved-${status}`).grant_status).toBe("reserved");
    },
  );

  test("authorizes only a current eligible token and lists path-free metadata", () => {
    const access = JSON.parse(
      runSql(
        `select to_jsonb(result) from public.authorize_digital_download_access('${tokenHash}') result`,
      ),
    ) as Record<string, unknown>;
    expect(access).toMatchObject({
      access_token_id: ids.token,
      order_id: ids.order,
      store_id: ids.store,
    });
    const file = JSON.parse(
      runSql(
        `select to_jsonb(result) from public.list_authorized_digital_downloads('${ids.token}') result`,
      ),
    ) as Record<string, unknown>;
    expect(file).toMatchObject({
      entitlement_id: ids.entitlement,
      customer_filename: "printable.pdf",
      grants_remaining: 5,
    });
    expect(file).not.toHaveProperty("storage_path");
    expect(file).not.toHaveProperty("asset_version_id");
    expect(file).not.toHaveProperty("order_id");
  });

  test("never oversubscribes the fifth grant in 20 repeated real PostgreSQL races", async () => {
    for (let iteration = 0; iteration < 20; iteration += 1) {
      runSql(`
        delete from public.digital_download_grants;
        update public.digital_order_entitlements
        set status = 'active', download_grants_used = 4
        where id = '${ids.entitlement}';
        insert into public.digital_download_grants(
          store_id, order_id, entitlement_id, access_token_id, reservation_key,
          client_fingerprint_hash, status, reserved_at, reservation_expires_at,
          issued_at, grace_expires_at
        )
        select
          '${ids.store}', '${ids.order}', '${ids.entitlement}', '${ids.token}',
          gen_random_uuid()::text, encode(digest(sequence::text, 'sha256'), 'hex'),
          'issued', now() - interval '2 hours', now() - interval '115 minutes',
          now() - interval '119 minutes', now() - interval '118 minutes'
        from generate_series(1, 4) sequence;
      `);
      const attempt = (suffix: string, fingerprint: string) =>
        runSqlAsync(
          `select public.commit_digital_download_grant(
            (
              select grant_id from public.reserve_digital_download_grant(
                '${ids.entitlement}', '${ids.token}',
                '${randomUUID()}', '${fingerprint}'
              )
            ),
            '${fingerprint}'
          )`,
          `grant-race-${iteration}-${suffix}`,
        );
      const outcomes = await Promise.allSettled([
        attempt("a", fingerprintA),
        attempt("b", fingerprintB),
      ]);

      expect(
        outcomes.filter((outcome) => outcome.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        runSql(
          `select download_grants_used from public.digital_order_entitlements where id = '${ids.entitlement}'`,
        ),
      ).toBe("5");
      expect(
        runSql(
          `select count(*) from public.digital_download_grants
           where entitlement_id = '${ids.entitlement}' and status = 'issued'`,
        ),
      ).toBe("5");
    }
  }, 30_000);

  test("keeps access and grant mutation RPCs service-role only", () => {
    for (const role of ["anon", "authenticated"] as const) {
      expectRejected(
        `set role ${role}; select * from public.authorize_digital_download_access('${tokenHash}'); reset role`,
      );
      expectRejected(
        `set role ${role}; select * from public.reserve_digital_download_grant(
          '${ids.entitlement}', '${ids.token}', '${randomUUID()}', '${fingerprintA}'
        ); reset role`,
      );
      expectRejected(
        `set role ${role}; select public.release_digital_download_reservation(
          '${ids.entitlement}', '${ids.token}', '${randomUUID()}', '${fingerprintA}',
          'Unauthorized cleanup'
        ); reset role`,
      );
    }
  });
});
