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

function usage() {
  console.log("Usage: node scripts/assign-store-owner.mjs <owner_email> [store_slug]");
}

const ownerEmail = process.argv[2]?.trim().toLowerCase();
const optionalSlug = process.argv[3]?.trim();

if (!ownerEmail) {
  usage();
  process.exit(1);
}

const envPath = path.resolve(".env.local");
if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local");
  process.exit(1);
}

const env = readEnvFile(envPath);
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const storeSlug = optionalSlug || env.MYRIVO_SINGLE_STORE_SLUG || "at-home-apothecary";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const { data: users, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) {
  console.error(`Failed to list users: ${listError.message}`);
  process.exit(1);
}

const user = users.users.find((entry) => (entry.email || "").toLowerCase() === ownerEmail);
if (!user) {
  console.error(`No auth user found for email: ${ownerEmail}`);
  process.exit(1);
}

const { data: store, error: storeError } = await supabase
  .from("stores")
  .select("id,name,slug,owner_user_id")
  .eq("slug", storeSlug)
  .single();

if (storeError) {
  console.error(`Failed to load store ${storeSlug}: ${storeError.message}`);
  process.exit(1);
}

const { data: updated, error: updateError } = await supabase
  .from("stores")
  .update({ owner_user_id: user.id })
  .eq("id", store.id)
  .select("id,name,slug,owner_user_id")
  .single();

if (updateError) {
  console.error(`Failed to update owner: ${updateError.message}`);
  process.exit(1);
}

console.log(JSON.stringify({
  message: "Store owner updated",
  store: updated,
  ownerEmail: user.email
}, null, 2));
