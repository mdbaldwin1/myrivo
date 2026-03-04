#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createHash } from "node:crypto";
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
    slug: null,
    out: null
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
    if (token.startsWith("--out=")) {
      args.out = token.slice("--out=".length).trim();
      continue;
    }
  }

  return args;
}

function usage() {
  console.log("Usage: node scripts/export-store-experience-snapshot.mjs [--slug=<store_slug>] [--out=<path>] [--env-file=.env.local]");
}

function stableStringify(value) {
  return JSON.stringify(value, Object.keys(value).sort(), 2);
}

const args = parseArgs(process.argv.slice(2));
const envPath = path.resolve(args.envFile);

if (!fs.existsSync(envPath)) {
  console.error(`Missing env file: ${envPath}`);
  usage();
  process.exit(1);
}

const env = readEnvFile(envPath);
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const storeSlug = (args.slug || env.MYRIVO_SINGLE_STORE_SLUG || "at-home-apothecary").trim().toLowerCase();

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const { data: store, error: storeError } = await supabase
  .from("stores")
  .select("id,owner_user_id,name,slug,status,stripe_account_id,created_at,updated_at")
  .eq("slug", storeSlug)
  .single();

if (storeError) {
  console.error(`Failed to load store ${storeSlug}: ${storeError.message}`);
  process.exit(1);
}

const [
  brandingResult,
  settingsResult,
  contentBlocksResult,
  promotionsResult,
  integrationsResult,
  subscribersResult
] = await Promise.all([
  supabase.from("store_branding").select("*").eq("store_id", store.id).maybeSingle(),
  supabase.from("store_settings").select("*").eq("store_id", store.id).maybeSingle(),
  supabase.from("store_content_blocks").select("*").eq("store_id", store.id).order("sort_order", { ascending: true }),
  supabase.from("promotions").select("*").eq("store_id", store.id).order("created_at", { ascending: true }),
  supabase.from("store_integrations").select("*").eq("store_id", store.id).maybeSingle(),
  supabase.from("store_email_subscribers").select("*").eq("store_id", store.id).order("created_at", { ascending: true })
]);

for (const [label, result] of [
  ["store_branding", brandingResult],
  ["store_settings", settingsResult],
  ["store_content_blocks", contentBlocksResult],
  ["promotions", promotionsResult],
  ["store_integrations", integrationsResult],
  ["store_email_subscribers", subscribersResult]
]) {
  if (result.error) {
    console.error(`Failed to load ${label}: ${result.error.message}`);
    process.exit(1);
  }
}

const snapshotPayload = {
  snapshotVersion: 1,
  createdAt: new Date().toISOString(),
  source: {
    storeSlug: store.slug,
    storeId: store.id
  },
  data: {
    store,
    store_branding: brandingResult.data ?? null,
    store_settings: settingsResult.data ?? null,
    store_content_blocks: contentBlocksResult.data ?? [],
    promotions: promotionsResult.data ?? [],
    store_integrations: integrationsResult.data ?? null,
    store_email_subscribers: subscribersResult.data ?? []
  }
};

const payloadHash = createHash("sha256").update(stableStringify(snapshotPayload.data)).digest("hex");
const snapshot = {
  ...snapshotPayload,
  checksum: {
    algorithm: "sha256",
    value: payloadHash
  }
};

const outputDir = path.resolve("memory/store-experience-snapshots");
fs.mkdirSync(outputDir, { recursive: true });

const outPath =
  args.out && args.out.trim().length > 0
    ? path.resolve(args.out)
    : path.join(outputDir, `${store.slug}-${new Date().toISOString().replaceAll(":", "-")}.json`);

fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

console.log(
  JSON.stringify(
    {
      message: "Snapshot exported",
      outPath,
      storeSlug: store.slug,
      checksum: snapshot.checksum.value,
      counts: {
        contentBlocks: snapshot.data.store_content_blocks.length,
        promotions: snapshot.data.promotions.length,
        emailSubscribers: snapshot.data.store_email_subscribers.length
      }
    },
    null,
    2
  )
);
