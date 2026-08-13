import fs from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

function fail(message) {
  console.error(`Digital products release gate failed: ${message}`);
  process.exit(1);
}

const fixturePath = process.env.MYRIVO_DIGITAL_ACCEPTANCE_FIXTURE;
const evidencePath = process.env.MYRIVO_DIGITAL_ACCEPTANCE_EVIDENCE;
if (!fixturePath || !fs.existsSync(fixturePath)) fail("acceptance fixture is missing");
if (!evidencePath || !fs.existsSync(evidencePath)) fail("acceptance evidence is missing");
for (const key of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "RESEND_API_KEY", "MYRIVO_DIGITAL_TEST_RECIPIENT"]) {
  if (!process.env[key]?.trim()) fail(`${key} is missing`);
}
if (process.env.STRIPE_STUB_MODE !== "false" || !process.env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
  fail("Stripe must be explicitly configured in test mode");
}
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const baseUrl = new URL(fixture.baseUrl);
const approvedHost = process.env.MYRIVO_DIGITAL_APPROVED_NONPROD_HOST?.trim().toLowerCase();
const loopback = ["127.0.0.1", "localhost", "::1"].includes(baseUrl.hostname);
if ((!loopback && (baseUrl.protocol !== "https:" || baseUrl.hostname !== approvedHost)) || /(^|\.)(myrivo\.com|athomeapothecary\.com)$/i.test(baseUrl.hostname)) {
  fail("fixture target must be loopback or the explicitly approved HTTPS non-production host");
}
for (const route of Object.values(fixture.routes ?? {})) {
  const resolved = new URL(String(route), baseUrl);
  if (resolved.origin !== baseUrl.origin) fail("fixture routes must be same-origin");
}
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
if (evidence.schemaVersion !== 2 || evidence.runId !== fixture.runId || evidence.origin !== baseUrl.origin || evidence.releaseVersion !== process.env.GITHUB_SHA) fail("evidence is not bound to this run, origin, and release");
if (!evidence.completedAt || Date.now() - Date.parse(evidence.completedAt) > 60 * 60 * 1000) fail("evidence is stale");
const digest = createHash("sha256").update(fs.readFileSync(evidencePath)).digest("hex");
console.log(`Validated redacted acceptance evidence sha256=${digest}`);
const result = spawnSync("npm", ["run", "-w", "@myrivo/web", "e2e", "--", "digital-products.spec.ts", "digital-products-accessibility.spec.ts"], {
  stdio: "inherit", env: { ...process.env, MYRIVO_DIGITAL_RELEASE_GATE: "true", E2E_BASE_URL: baseUrl.origin, E2E_MANAGED_SERVER: "false" },
});
if (result.status !== 0) process.exit(result.status ?? 1);
