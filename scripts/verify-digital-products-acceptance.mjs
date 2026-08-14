import fs from "node:fs";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { spawnSync } from "node:child_process";

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
const serializedEvidence = JSON.stringify(evidence);
for (const forbidden of [/(^|[?&#])token=/i, /cookie[^\n]{0,64}[=:]/i, /[?&](signature|x-amz-signature)=/i, /(^|["'/:])private\//i, /digital_download_session/i]) {
  if (forbidden.test(serializedEvidence)) fail("evidence contains bearer or private-path material");
}
const signature = evidence.signature; delete evidence.signature;
const expectedSignature = createHmac("sha256", evidenceKey).update(JSON.stringify(evidence)).digest("hex");
if (typeof signature !== "string" || !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) fail("evidence signature is invalid");
if (evidence.schemaVersion !== 3 || evidence.runId !== fixture.runId || evidence.origin !== baseUrl.origin || evidence.releaseVersion !== (process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA) || !Array.isArray(evidence.observations)) fail("evidence is incomplete or not run-bound");
const requiredActions = new Set(["observe:stripe-digital", "observe:stripe-mixed", "observe:resend-access", "observe:five-grants", "observe:replacement", "observe:stripe-partial-refund", "observe:stripe-full-refund", "observe:stripe-dispute-opened", "observe:stripe-dispute-won", "observe:stripe-dispute-lost", "observe:delivery-retry", "observe:merchant-resend"]);
const fixedScenarioSubjects = new Map([
  ["replacement", fixture.orderId], ["delivery-retry", fixture.orderId], ["merchant-resend", fixture.orderId],
  ["stripe-partial-refund", fixture.financialOrders?.partialRefund], ["stripe-full-refund", fixture.financialOrders?.fullRefund],
  ["stripe-dispute-opened", fixture.financialOrders?.disputeOpened],
  ["stripe-dispute-won", fixture.financialOrders?.disputeWon], ["stripe-dispute-lost", fixture.financialOrders?.disputeLost],
]);
const seenScenarios = new Set();
for (const item of evidence.observations) {
  if (item.scenario && seenScenarios.has(item.scenario)) fail(`duplicate scenario evidence: ${item.scenario}`);
  if (item.scenario) seenScenarios.add(item.scenario);
  requiredActions.delete(`${item.action}:${item.scenario ?? ""}`);
  const expectedSubject = fixedScenarioSubjects.get(item.scenario);
  if (item.runId !== fixture.runId || !item.observedAt || !item.subjectId || !item.observation?.order || item.observation.order.id !== item.subjectId || (expectedSubject && item.subjectId !== expectedSubject)) fail("an observation is null, stale, or unlinked");
  if (item.observation.providerPayment && (item.observation.providerPayment.livemode !== false || item.observation.providerPayment.status !== "succeeded")) fail("provider payment is not a succeeded test-mode payment");
  if (item.scenario === "stripe-digital" && item.observation.order.checkout_composition !== "digital_only") fail("digital checkout composition evidence is wrong");
  if (item.scenario === "stripe-mixed" && item.observation.order.checkout_composition !== "mixed") fail("mixed checkout composition evidence is wrong");
  if (item.scenario === "five-grants") {
    const grants = item.observation.grants;
    if (grants.length !== 5 || new Set(grants.map((grant) => grant.id)).size !== 5) fail("five-grant evidence is not exact and unique");
  }
  if (!item.providerEvidence?.kind) fail(`scenario ${item.scenario} has no typed provider evidence`);
  if (["stripe-digital", "stripe-mixed"].includes(item.scenario) && (item.providerEvidence.kind !== "checkout" || item.providerEvidence.orderId !== item.subjectId || item.providerEvidence.paymentIntentId !== item.observation.providerPayment.id)) fail("checkout provider evidence is uncorrelated");
  if (["stripe-partial-refund", "stripe-full-refund"].includes(item.scenario) && (item.providerEvidence.kind !== "refund" || item.providerEvidence.paymentIntentId !== item.observation.providerPayment.id || !item.providerEvidence.webhook?.signatureVerified || item.providerEvidence.webhook.status !== "processed")) fail("refund provider/webhook evidence is uncorrelated");
  if (["stripe-dispute-opened", "stripe-dispute-won", "stripe-dispute-lost"].includes(item.scenario) && (item.providerEvidence.kind !== "dispute" || item.providerEvidence.paymentIntentId !== item.observation.providerPayment.id || !item.providerEvidence.webhook?.signatureVerified || item.providerEvidence.webhook.status !== "processed")) fail("dispute provider/webhook evidence is uncorrelated");
  if (["resend-access", "merchant-resend"].includes(item.scenario) && (item.providerEvidence.kind !== "resend" || item.providerEvidence.orderId !== item.subjectId || item.providerEvidence.recipient !== fixture.customer.email)) fail("Resend provider evidence is uncorrelated");
  if (!item.observation.manifestItems?.length || item.observation.manifestItems.some((manifest) => !manifest.asset_version_id)) fail("manifest evidence is missing asset versions");
}
if (requiredActions.size) fail(`evidence is missing required actions: ${[...requiredActions].join(", ")}`);
if (!evidence.completedAt || Date.now() - Date.parse(evidence.completedAt) > 60 * 60 * 1000) fail("evidence is stale");
const digest = createHash("sha256").update(fs.readFileSync(evidencePath)).digest("hex");
console.log(`Validated current-run acceptance evidence sha256=${digest}`);
