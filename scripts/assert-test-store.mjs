#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const EXPECTED_TEST_SLUG = "test-store";

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
  const args = { envFile: ".env.local", slug: null };
  for (const token of argv) {
    if (token.startsWith("--env-file=")) {
      args.envFile = token.slice("--env-file=".length).trim();
      continue;
    }
    if (token.startsWith("--slug=")) {
      args.slug = token.slice("--slug=".length).trim().toLowerCase();
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
const activeSlug = (args.slug || env.MYRIVO_SINGLE_STORE_SLUG || "").trim().toLowerCase();

if (!activeSlug) {
  console.error(`Missing MYRIVO_SINGLE_STORE_SLUG in ${envPath}. Refusing destructive operation.`);
  process.exit(1);
}

if (activeSlug !== EXPECTED_TEST_SLUG) {
  console.error(
    `Refusing destructive operation: active store slug is "${activeSlug}", expected "${EXPECTED_TEST_SLUG}".`
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      message: "Test-store safety check passed",
      envFile: envPath,
      activeSlug
    },
    null,
    2
  )
);
