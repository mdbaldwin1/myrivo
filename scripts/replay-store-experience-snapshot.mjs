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
    snapshotPath: null,
    slug: null,
    replace: false
  };

  for (const token of argv) {
    if (token.startsWith("--env-file=")) {
      args.envFile = token.slice("--env-file=".length).trim();
      continue;
    }
    if (token.startsWith("--slug=")) {
      args.slug = token.slice("--slug=".length).trim().toLowerCase();
      continue;
    }
    if (token === "--replace") {
      args.replace = true;
      continue;
    }
    if (!token.startsWith("--") && !args.snapshotPath) {
      args.snapshotPath = token.trim();
    }
  }

  return args;
}

function usage() {
  console.log("Usage: node scripts/replay-store-experience-snapshot.mjs <snapshot_path> [--slug=<store_slug>] [--replace] [--env-file=.env.local]");
}

function stripImmutableColumns(record) {
  if (!record || typeof record !== "object") {
    return record;
  }
  const next = { ...record };
  delete next.created_at;
  delete next.updated_at;
  return next;
}

const args = parseArgs(process.argv.slice(2));
if (!args.snapshotPath) {
  usage();
  process.exit(1);
}

const snapshotFile = path.resolve(args.snapshotPath);
if (!fs.existsSync(snapshotFile)) {
  console.error(`Snapshot file not found: ${snapshotFile}`);
  process.exit(1);
}

const envPath = path.resolve(args.envFile);
if (!fs.existsSync(envPath)) {
  console.error(`Missing env file: ${envPath}`);
  process.exit(1);
}

const snapshotRaw = fs.readFileSync(snapshotFile, "utf8");
const snapshot = JSON.parse(snapshotRaw);

if (!snapshot?.data?.store?.slug || !snapshot?.data?.store?.id) {
  console.error("Snapshot format invalid: missing store metadata.");
  process.exit(1);
}

const env = readEnvFile(envPath);
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env file.");
  process.exit(1);
}

const targetSlug = (args.slug || snapshot.data.store.slug).trim().toLowerCase();
const expectedTestSlug = "test-store";
if (targetSlug !== expectedTestSlug) {
  console.error(
    `Refusing snapshot replay because target slug is "${targetSlug}", expected "${expectedTestSlug}".`
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const { data: targetStore, error: targetStoreError } = await supabase
  .from("stores")
  .select("id,slug,name,status")
  .eq("slug", targetSlug)
  .single();

if (targetStoreError) {
  console.error(`Unable to load target store ${targetSlug}: ${targetStoreError.message}`);
  process.exit(1);
}

const targetStoreId = targetStore.id;
const source = snapshot.data;

if (source.store?.name) {
  const { error: storeUpdateError } = await supabase
    .from("stores")
    .update({
      name: source.store.name,
      status: source.store.status ?? targetStore.status,
      stripe_account_id: source.store.stripe_account_id ?? null
    })
    .eq("id", targetStoreId);

  if (storeUpdateError) {
    console.error(`Failed to update store metadata: ${storeUpdateError.message}`);
    process.exit(1);
  }
}

if (source.store_branding) {
  const brandingRecord = {
    ...stripImmutableColumns(source.store_branding),
    store_id: targetStoreId
  };
  const { error } = await supabase.from("store_branding").upsert(brandingRecord, { onConflict: "store_id" });
  if (error) {
    console.error(`Failed to replay store_branding: ${error.message}`);
    process.exit(1);
  }
}

if (source.store_settings) {
  const settingsRecord = {
    ...stripImmutableColumns(source.store_settings),
    store_id: targetStoreId
  };
  const { error } = await supabase.from("store_settings").upsert(settingsRecord, { onConflict: "store_id" });
  if (error) {
    console.error(`Failed to replay store_settings: ${error.message}`);
    process.exit(1);
  }
}

if (source.store_integrations) {
  const integrationsRecord = {
    ...stripImmutableColumns(source.store_integrations),
    store_id: targetStoreId
  };
  const { error } = await supabase.from("store_integrations").upsert(integrationsRecord, { onConflict: "store_id" });
  if (error) {
    console.error(`Failed to replay store_integrations: ${error.message}`);
    process.exit(1);
  }
}

async function replaceCollection(table, rows) {
  if (args.replace) {
    const { error: deleteError } = await supabase.from(table).delete().eq("store_id", targetStoreId);
    if (deleteError) {
      console.error(`Failed to clear ${table}: ${deleteError.message}`);
      process.exit(1);
    }
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }

  const normalized = rows.map((row) => ({
    ...stripImmutableColumns(row),
    store_id: targetStoreId
  }));

  const conflictColumnByTable = {
    store_content_blocks: "id",
    promotions: "id",
    store_email_subscribers: "id"
  };

  const { error } = await supabase.from(table).upsert(normalized, {
    onConflict: conflictColumnByTable[table]
  });

  if (error) {
    console.error(`Failed to replay ${table}: ${error.message}`);
    process.exit(1);
  }
}

await replaceCollection("store_content_blocks", source.store_content_blocks ?? []);
await replaceCollection("promotions", source.promotions ?? []);
await replaceCollection("store_email_subscribers", source.store_email_subscribers ?? []);

console.log(
  JSON.stringify(
    {
      message: "Snapshot replay complete",
      targetStoreSlug: targetSlug,
      replaceMode: args.replace,
      counts: {
        contentBlocks: (source.store_content_blocks ?? []).length,
        promotions: (source.promotions ?? []).length,
        emailSubscribers: (source.store_email_subscribers ?? []).length
      }
    },
    null,
    2
  )
);
