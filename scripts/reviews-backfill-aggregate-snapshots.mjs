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
    dryRun: false,
    storeSlug: null,
    prune: false
  };

  for (const token of argv) {
    if (token.startsWith("--env-file=")) {
      args.envFile = token.slice("--env-file=".length).trim();
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--prune") {
      args.prune = true;
      continue;
    }
    if (token.startsWith("--store-slug=")) {
      args.storeSlug = token.slice("--store-slug=".length).trim() || null;
      continue;
    }
  }

  return args;
}

function keyFor(storeId, productId) {
  return `${storeId}:${productId ?? "store"}`;
}

function emptyAggregate(storeId, productId) {
  return {
    store_id: storeId,
    product_id: productId,
    review_count: 0,
    average_rating: 0,
    rating_1_count: 0,
    rating_2_count: 0,
    rating_3_count: 0,
    rating_4_count: 0,
    rating_5_count: 0
  };
}

function computeAverage(row) {
  if (row.review_count < 1) {
    return 0;
  }
  const weighted =
    row.rating_1_count * 1 +
    row.rating_2_count * 2 +
    row.rating_3_count * 3 +
    row.rating_4_count * 4 +
    row.rating_5_count * 5;
  return Number((weighted / row.review_count).toFixed(2));
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

let storeFilterId = null;
if (args.storeSlug) {
  const { data: store, error } = await supabase.from("stores").select("id,slug").eq("slug", args.storeSlug).maybeSingle();
  if (error) {
    console.error(`Unable to resolve store slug '${args.storeSlug}': ${error.message}`);
    process.exit(1);
  }
  if (!store?.id) {
    console.error(`Store not found for slug '${args.storeSlug}'.`);
    process.exit(1);
  }
  storeFilterId = store.id;
}

let reviewsQuery = supabase.from("reviews").select("store_id,product_id,rating").eq("status", "published");
if (storeFilterId) {
  reviewsQuery = reviewsQuery.eq("store_id", storeFilterId);
}

const { data: reviews, error: reviewsError } = await reviewsQuery;
if (reviewsError) {
  console.error(`Unable to query published reviews: ${reviewsError.message}`);
  process.exit(1);
}

const aggregateByKey = new Map();
for (const review of reviews ?? []) {
  const storeId = review.store_id;
  const productId = review.product_id ?? null;
  const key = keyFor(storeId, productId);
  const existing = aggregateByKey.get(key) ?? emptyAggregate(storeId, productId);

  existing.review_count += 1;
  if (review.rating >= 1 && review.rating <= 5) {
    existing[`rating_${review.rating}_count`] += 1;
  }
  aggregateByKey.set(key, existing);
}

const rows = Array.from(aggregateByKey.values()).map((row) => ({
  ...row,
  average_rating: computeAverage(row)
}));

console.log(`Computed ${rows.length} aggregate snapshot rows from ${(reviews ?? []).length} published reviews.`);
if (args.dryRun) {
  console.log("Dry run enabled; no writes were made.");
  process.exit(0);
}

if (rows.length > 0) {
  const { error: upsertError } = await supabase
    .from("review_aggregate_snapshots")
    .upsert(rows, { onConflict: "store_id,product_id", ignoreDuplicates: false });

  if (upsertError) {
    console.error(`Unable to upsert review aggregate snapshots: ${upsertError.message}`);
    process.exit(1);
  }
}

if (args.prune) {
  const { data: existingSnapshots, error: snapshotsError } = await supabase.from("review_aggregate_snapshots").select("store_id,product_id");
  if (snapshotsError) {
    console.error(`Unable to query existing snapshots for prune: ${snapshotsError.message}`);
    process.exit(1);
  }

  const stale = (existingSnapshots ?? []).filter((row) => {
    if (storeFilterId && row.store_id !== storeFilterId) {
      return false;
    }
    return !aggregateByKey.has(keyFor(row.store_id, row.product_id ?? null));
  });

  for (const row of stale) {
    let deletion = supabase.from("review_aggregate_snapshots").delete().eq("store_id", row.store_id);
    deletion = row.product_id ? deletion.eq("product_id", row.product_id) : deletion.is("product_id", null);
    const { error: deleteError } = await deletion;
    if (deleteError) {
      console.error(`Unable to delete stale snapshot ${keyFor(row.store_id, row.product_id ?? null)}: ${deleteError.message}`);
      process.exit(1);
    }
  }

  console.log(`Pruned ${stale.length} stale snapshot rows.`);
}

console.log("Review aggregate snapshot backfill completed.");

