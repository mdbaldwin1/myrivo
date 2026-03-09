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
    envFile: ".env.local.test",
    ownerEmail: null,
    ownerPassword: null,
    storeSlug: null,
    storeName: null
  };

  for (const token of argv) {
    if (token.startsWith("--env-file=")) {
      args.envFile = token.slice("--env-file=".length).trim();
      continue;
    }
    if (token.startsWith("--owner-email=")) {
      args.ownerEmail = token.slice("--owner-email=".length).trim();
      continue;
    }
    if (token.startsWith("--owner-password=")) {
      args.ownerPassword = token.slice("--owner-password=".length).trim();
      continue;
    }
    if (token.startsWith("--store-slug=")) {
      args.storeSlug = token.slice("--store-slug=".length).trim().toLowerCase();
      continue;
    }
    if (token.startsWith("--store-name=")) {
      args.storeName = token.slice("--store-name=".length).trim();
      continue;
    }
  }

  return args;
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

const ownerEmail = (args.ownerEmail || env.E2E_OWNER_EMAIL || "").trim().toLowerCase();
const ownerPassword = (args.ownerPassword || env.E2E_OWNER_PASSWORD || "").trim();
const storeSlug = (args.storeSlug || env.MYRIVO_SINGLE_STORE_SLUG || "test-store").trim().toLowerCase();
const storeName = (args.storeName || "Myrivo Test Store").trim();
const expectedTestSlug = "test-store";

if (storeSlug !== expectedTestSlug) {
  console.error(
    `Refusing setup:test-env because store slug is "${storeSlug}", expected "${expectedTestSlug}".`
  );
  process.exit(1);
}

if (!ownerEmail || !ownerPassword) {
  console.error("Missing owner credentials. Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD in env, or pass --owner-email/--owner-password.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function ensureOwnerUser() {
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) {
    throw new Error(`Unable to list users: ${usersError.message}`);
  }

  const existing = usersData.users.find((entry) => (entry.email || "").toLowerCase() === ownerEmail);
  if (existing) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
      password: ownerPassword,
      email_confirm: true
    });
    if (updateError) {
      throw new Error(`Unable to update existing owner user: ${updateError.message}`);
    }
    return existing.id;
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true
  });

  if (createError || !created.user) {
    throw new Error(`Unable to create owner user: ${createError?.message ?? "unknown error"}`);
  }

  return created.user.id;
}

const ownerUserId = await ensureOwnerUser();

const { data: existingStore, error: existingStoreError } = await supabase
  .from("stores")
  .select("id")
  .eq("slug", storeSlug)
  .maybeSingle();

if (existingStoreError) {
  throw new Error(`Unable to load existing store: ${existingStoreError.message}`);
}

let storeId = existingStore?.id ?? null;

if (!storeId) {
  const { data: insertedStore, error: insertedStoreError } = await supabase
    .from("stores")
    .insert({
      owner_user_id: ownerUserId,
      name: storeName,
      slug: storeSlug,
      status: "active"
    })
    .select("id")
    .single();

  if (insertedStoreError || !insertedStore) {
    throw new Error(`Unable to create test store: ${insertedStoreError?.message ?? "unknown error"}`);
  }

  storeId = insertedStore.id;
} else {
  const { error: updateStoreError } = await supabase
    .from("stores")
    .update({
      owner_user_id: ownerUserId,
      name: storeName,
      status: "active"
    })
    .eq("id", storeId);
  if (updateStoreError) {
    throw new Error(`Unable to update test store: ${updateStoreError.message}`);
  }
}

const { error: brandingError } = await supabase.from("store_branding").upsert(
  {
    store_id: storeId,
    primary_color: "#0F7B84",
    accent_color: "#1AA3A8",
    theme_json: {}
  },
  { onConflict: "store_id" }
);
if (brandingError) {
  throw new Error(`Unable to upsert store_branding: ${brandingError.message}`);
}

const { error: settingsError } = await supabase.from("store_settings").upsert(
  {
    store_id: storeId,
    checkout_enable_local_pickup: true,
    checkout_local_pickup_label: "Local pickup",
    checkout_local_pickup_fee_cents: 0,
    checkout_enable_flat_rate_shipping: true,
    checkout_flat_rate_shipping_label: "Shipping",
    checkout_flat_rate_shipping_fee_cents: 0,
    checkout_allow_order_note: true,
    checkout_order_note_prompt: "Add a note to your order."
  },
  { onConflict: "store_id" }
);
if (settingsError) {
  throw new Error(`Unable to upsert store_settings: ${settingsError.message}`);
}

const { error: promoError } = await supabase.from("promotions").upsert(
  {
    store_id: storeId,
    code: "WELCOME10",
    discount_type: "percent",
    discount_value: 10,
    min_subtotal_cents: 0,
    is_active: true
  },
  { onConflict: "store_id,code" }
);
if (promoError) {
  throw new Error(`Unable to upsert promotion: ${promoError.message}`);
}

console.log(
  JSON.stringify(
    {
      message: "Test environment is ready",
      envFile: envPath,
      store: { id: storeId, slug: storeSlug, name: storeName, status: "active" },
      owner: { email: ownerEmail },
      seeded: { promotion: "WELCOME10" }
    },
    null,
    2
  )
);
