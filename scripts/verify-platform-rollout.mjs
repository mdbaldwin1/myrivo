#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return Object.fromEntries(
    raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        if (index === -1) return null;
        return [line.slice(0, index), line.slice(index + 1)];
      })
      .filter(Boolean)
  );
}

function parseArgs(argv) {
  const args = {
    envFile: ".env.local",
    strict: true
  };

  for (const token of argv) {
    if (token.startsWith("--env-file=")) {
      args.envFile = token.slice("--env-file=".length).trim();
      continue;
    }
    if (token === "--no-strict") {
      args.strict = false;
      continue;
    }
  }

  return args;
}

const REQUIRED_MIGRATIONS = [
  "20260303234500",
  "20260304003000",
  "20260304170000",
  "20260304190000",
  "20260304233000",
  "20260304235500"
];

function logPass(message) {
  console.log(`PASS: ${message}`);
}

function logWarn(message) {
  console.warn(`WARN: ${message}`);
}

function logFail(message) {
  console.error(`FAIL: ${message}`);
}

const args = parseArgs(process.argv.slice(2));
const envPath = path.resolve(args.envFile);

if (!fs.existsSync(envPath)) {
  console.error(`Missing env file: ${envPath}`);
  process.exit(1);
}

const env = readEnvFile(envPath);
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const failures = [];
const warnings = [];

function recordFailure(message) {
  failures.push(message);
  logFail(message);
}

function recordWarning(message) {
  warnings.push(message);
  logWarn(message);
}

async function ensureRequiredMigrations() {
  const { data, error } = await supabase.schema("supabase_migrations").from("schema_migrations").select("version");
  if (error) {
    recordWarning(`Unable to query supabase_migrations.schema_migrations via PostgREST: ${error.message}`);
    return;
  }

  const applied = new Set((data ?? []).map((entry) => String(entry.version)));
  const missing = REQUIRED_MIGRATIONS.filter((version) => !applied.has(version));
  if (missing.length > 0) {
    recordFailure(`Missing required migrations: ${missing.join(", ")}`);
    return;
  }

  logPass(`Required migrations present (${REQUIRED_MIGRATIONS.join(", ")})`);
}

async function ensureSchemaSurface() {
  const checks = [
    {
      name: "store_memberships.permissions_json",
      run: () => supabase.from("store_memberships").select("id,store_id,user_id,role,status,permissions_json").limit(1)
    },
    {
      name: "store_domains hosting columns",
      run: () =>
        supabase
          .from("store_domains")
          .select("id,domain,verification_status,verification_token,hosting_status,hosting_metadata_json")
          .limit(1)
    },
    {
      name: "pickup settings core columns",
      run: () =>
        supabase
          .from("store_pickup_settings")
          .select(
            "store_id,pickup_enabled,selection_mode,eligibility_radius_miles,lead_time_hours,slot_interval_minutes,timezone,show_pickup_times"
          )
          .limit(1)
    },
    {
      name: "pickup locations table",
      run: () => supabase.from("pickup_locations").select("id,store_id,name,latitude,longitude,is_active").limit(1)
    },
    {
      name: "pickup hours table",
      run: () => supabase.from("pickup_location_hours").select("id,pickup_location_id,day_of_week,opens_at,closes_at").limit(1)
    },
    {
      name: "pickup blackouts table",
      run: () => supabase.from("pickup_blackout_dates").select("id,store_id,starts_at,ends_at,reason").limit(1)
    },
    {
      name: "customer account tables",
      run: () =>
        supabase
          .from("customer_profiles")
          .select("id,user_id,preferences_json")
          .limit(1)
    },
    {
      name: "billing plan/profile/fees tables",
      run: () =>
        supabase
          .from("billing_plans")
          .select("id,key,transaction_fee_bps,transaction_fee_fixed_cents,feature_flags_json")
          .limit(1)
    }
  ];

  for (const check of checks) {
    const { error } = await check.run();
    if (error) {
      recordFailure(`Schema check failed for ${check.name}: ${error.message}`);
    } else {
      logPass(`Schema check passed: ${check.name}`);
    }
  }
}

async function ensureStoreOwnerMembershipIntegrity() {
  const [{ data: stores, error: storesError }, { data: memberships, error: membershipsError }] = await Promise.all([
    supabase.from("stores").select("id,owner_user_id"),
    supabase.from("store_memberships").select("store_id,user_id,role,status")
  ]);

  if (storesError) {
    recordFailure(`Unable to query stores: ${storesError.message}`);
    return;
  }
  if (membershipsError) {
    recordFailure(`Unable to query store memberships: ${membershipsError.message}`);
    return;
  }

  const membershipIndex = new Set(
    (memberships ?? [])
      .filter((membership) => membership.status === "active" && membership.role === "owner")
      .map((membership) => `${membership.store_id}:${membership.user_id}`)
  );

  const missing = (stores ?? [])
    .filter((store) => !membershipIndex.has(`${store.id}:${store.owner_user_id}`))
    .map((store) => store.id);

  if (missing.length > 0) {
    recordFailure(`Owner membership integrity failed for stores: ${missing.join(", ")}`);
    return;
  }

  logPass("Each store owner has an active owner membership row");
}

async function ensureBillingProfileCoverage() {
  const [{ data: stores, error: storesError }, { data: billingProfiles, error: billingError }] = await Promise.all([
    supabase.from("stores").select("id"),
    supabase.from("store_billing_profiles").select("store_id,test_mode_enabled")
  ]);

  if (storesError) {
    recordFailure(`Unable to query stores for billing coverage: ${storesError.message}`);
    return;
  }

  if (billingError) {
    recordFailure(`Unable to query store_billing_profiles: ${billingError.message}`);
    return;
  }

  const profileStoreIds = new Set((billingProfiles ?? []).map((entry) => entry.store_id));
  const missing = (stores ?? []).filter((store) => !profileStoreIds.has(store.id)).map((store) => store.id);

  if (missing.length > 0) {
    const message = `Stores missing billing profile rows: ${missing.join(", ")}`;
    if (args.strict) {
      recordFailure(message);
    } else {
      recordWarning(message);
    }
  } else {
    logPass("All stores have a billing profile row");
  }
}

async function ensurePendingDomainTokens() {
  const { data, error } = await supabase
    .from("store_domains")
    .select("id,domain,verification_status,verification_token")
    .in("verification_status", ["pending", "failed"]);

  if (error) {
    recordFailure(`Unable to query pending/failed domains: ${error.message}`);
    return;
  }

  const missingTokens = (data ?? []).filter((entry) => !entry.verification_token).map((entry) => `${entry.id}:${entry.domain}`);
  if (missingTokens.length > 0) {
    recordFailure(`Pending/failed domains missing verification token: ${missingTokens.join(", ")}`);
    return;
  }

  logPass("All pending/failed domains have verification tokens");
}

async function main() {
  console.log(`Running platform rollout verification against ${supabaseUrl}`);
  console.log(`Using env file: ${envPath}`);

  await ensureRequiredMigrations();
  await ensureSchemaSurface();
  await ensureStoreOwnerMembershipIntegrity();
  await ensureBillingProfileCoverage();
  await ensurePendingDomainTokens();

  if (warnings.length > 0) {
    console.warn(`Completed with ${warnings.length} warning(s).`);
  }

  if (failures.length > 0) {
    console.error(`Verification failed with ${failures.length} failure(s).`);
    process.exit(1);
  }

  console.log("Platform rollout verification passed.");
}

await main();
