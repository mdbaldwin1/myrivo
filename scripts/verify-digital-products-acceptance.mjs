import fs from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { verifyDigitalAcceptanceArtifact } from "../apps/web/lib/digital-products/acceptance-evidence.ts";

function fail(message) {
  console.error(`Digital products release gate failed: ${message}`);
  process.exit(1);
}

const fixturePath = process.env.MYRIVO_DIGITAL_ACCEPTANCE_FIXTURE;
const evidencePath = process.env.MYRIVO_DIGITAL_ACCEPTANCE_EVIDENCE_OUTPUT;
if (!fixturePath || !fs.existsSync(fixturePath)) fail("acceptance fixture is missing");
if (!evidencePath) fail("acceptance evidence output path is missing");
for (const key of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "RESEND_API_KEY", "MYRIVO_DIGITAL_TEST_RECIPIENT"]) {
  if (!process.env[key]?.trim()) fail(`${key} is missing`);
}
for (const key of ["MYRIVO_STRIPE_DISPUTE_HELPER_URL", "MYRIVO_STRIPE_DISPUTE_HELPER_TOKEN", "MYRIVO_STRIPE_DISPUTE_HELPER_SIGNING_KEY", "MYRIVO_STRIPE_DISPUTE_HELPER_ORIGIN"]) {
  if (!process.env[key]?.trim()) fail(`exact Stripe dispute won/lost scenarios require ${key}`);
}
const disputeHelperUrl = new URL(process.env.MYRIVO_STRIPE_DISPUTE_HELPER_URL);
if (disputeHelperUrl.protocol !== "https:" || disputeHelperUrl.origin !== process.env.MYRIVO_STRIPE_DISPUTE_HELPER_ORIGIN || new URL(process.env.MYRIVO_STRIPE_DISPUTE_HELPER_ORIGIN).origin !== process.env.MYRIVO_STRIPE_DISPUTE_HELPER_ORIGIN) fail("Stripe dispute helper URL must match the exact allowlisted HTTPS origin");
const evidenceKey = process.env.MYRIVO_DIGITAL_ACCEPTANCE_EVIDENCE_HMAC_KEY?.trim();
const redactionKey = process.env.MYRIVO_DIGITAL_ACCEPTANCE_REDACTION_KEY?.trim();
if (process.env.STRIPE_STUB_MODE !== "false" || !process.env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
  fail("Stripe must be explicitly configured in test mode");
}
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
if (!evidenceKey || evidenceKey.length < 32 || evidenceKey === fixture.controlSecret) fail("a separate evidence HMAC key is required");
if (!redactionKey || redactionKey.length < 32 || redactionKey === evidenceKey || redactionKey === fixture.controlSecret) fail("a separate evidence redaction key is required");
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
const result = spawnSync("npm", ["run", "-w", "@myrivo/web", "e2e", "--", "digital-products.spec.ts", "digital-products-accessibility.spec.ts"], {
  stdio: "inherit", env: { ...process.env, MYRIVO_DIGITAL_RELEASE_GATE: "true", MYRIVO_DIGITAL_RELEASE_SHA: process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA, E2E_BASE_URL: baseUrl.origin, E2E_MANAGED_SERVER: loopback ? "true" : "false" },
});
if (result.status !== 0) process.exit(result.status ?? 1);
if (!fs.existsSync(evidencePath)) fail("acceptance run did not generate evidence");
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
try {
  verifyDigitalAcceptanceArtifact(evidence, {
    key: evidenceKey,
    requiredScenarios: ["stripe-digital", "stripe-mixed", "resend-access", "five-grants", "replacement", "stripe-partial-refund", "stripe-full-refund", "stripe-dispute-opened", "stripe-dispute-won", "stripe-dispute-lost", "delivery-retry", "merchant-resend"],
    expectedRunId: fixture.runId,
    expectedOrigin: baseUrl.origin,
    expectedReleaseVersion: process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA,
    expectedRecipient: fixture.customer.email,
    expectedScenarioSubjects: {
      replacement: fixture.orderId,
      "delivery-retry": fixture.orderId,
      "merchant-resend": fixture.orderId,
      "stripe-partial-refund": fixture.financialOrders?.partialRefund,
      "stripe-full-refund": fixture.financialOrders?.fullRefund,
      "stripe-dispute-opened": fixture.financialOrders?.disputeOpened,
      "stripe-dispute-won": fixture.financialOrders?.disputeWon,
      "stripe-dispute-lost": fixture.financialOrders?.disputeLost,
    },
  });
} catch (error) {
  fail(`canonical evidence validation failed: ${error instanceof Error ? error.message : "invalid evidence"}`);
}
const digest = createHash("sha256").update(fs.readFileSync(evidencePath)).digest("hex");
console.log(`Validated current-run acceptance evidence sha256=${digest}`);
