import { describe, expect, it } from "vitest";
import { assertNoAcceptanceSecrets, digitalAcceptanceObservationSchema, digitalAcceptanceScenarioEvidenceSchema, digitalAcceptanceSignedEvidenceSchema, hashAcceptanceSession, verifyDigitalAcceptanceEvidence } from "@/lib/digital-products/acceptance-evidence";

describe("digital acceptance evidence", () => {
  it("rejects null, live-mode, unlinked, or unexpected observations", () => {
    expect(() => digitalAcceptanceObservationSchema.parse({ action: "observe", order: null })).toThrow();
    expect(() => digitalAcceptanceObservationSchema.parse({ action: "observe", orderId: crypto.randomUUID(), storeId: crypto.randomUUID(), payment: { id: "pi_1", status: "succeeded", livemode: true }, delivery: { id: crypto.randomUUID(), status: "succeeded", attemptCount: 1 }, manifestVersionIds: [], grants: [] })).toThrow();
  });

  it("rejects duplicate or partially shaped records in the canonical signed envelope", () => {
    expect(() => digitalAcceptanceSignedEvidenceSchema.parse({ schemaVersion: 3, runId: crypto.randomUUID(), origin: "https://preview.example.test", releaseVersion: "sha", environment: "preview", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), observations: [{ action: "observe", scenario: "five-grants", providerEvidence: {} }], signature: "a".repeat(64) })).toThrow();
  });

  it("accepts and semantically verifies a complete canonical signed envelope", () => {
    const id = (prefix: string) => `${prefix.padEnd(8, "0")}-0000-4000-8000-000000000001`;
    const orderId = id("10000000"), storeId = id("20000000"), entitlementId = id("30000000"), versionId = id("40000000"), jobId = id("50000000");
    const observation = { order: { id: orderId, store_id: storeId, status: "paid", payment_status: "paid", refund_status: null, dispute_status: null, stripe_payment_intent_id: "pi_1", checkout_composition: "digital_only" }, deliveryJob: { id: jobId, status: "succeeded", attempt_count: 2, last_safe_error: null }, grants: [], entitlements: [{ id: entitlementId, asset_version_id: versionId, download_grants_used: 0, customer_filename: "art.png", status: "active" }], notifications: [], manifestItems: [{ asset_version_id: versionId, customer_filename: "art.png" }], providerPayment: { id: "pi_1", status: "succeeded", livemode: false }, refunds: [], disputes: [], webhookEvents: [], deliveryAttempts: [], catalogAssetVersions: [{ id: id("60000000"), current_version_id: versionId, customer_filename: "art.png" }] };
    const record = { action: "observe" as const, scenario: "stripe-digital" as const, providerEvidence: { kind: "checkout" as const, sessionId: "cs_test_1", paymentIntentId: "pi_1", orderId }, version: 1 as const, runId: id("70000000"), subjectId: orderId, observedAt: new Date().toISOString(), observation };
    const envelope = { schemaVersion: 3 as const, runId: record.runId, origin: "https://preview.example.test", releaseVersion: "sha", environment: "preview" as const, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), observations: [record], signature: "a".repeat(64) };
    expect(digitalAcceptanceSignedEvidenceSchema.parse(envelope).observations).toHaveLength(1);
    expect(verifyDigitalAcceptanceEvidence(envelope, { requiredScenarios: ["stripe-digital"] }).observations).toHaveLength(1);
  });

  it("hashes sessions with a domain-separated redaction key and rejects serialized secrets recursively", () => {
    const key = "r".repeat(32);
    expect(hashAcceptanceSession("cookie=value", key)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashAcceptanceSession("cookie=value", key)).not.toBe(hashAcceptanceSession("cookie=value", "s".repeat(32)));
    for (const leaked of [
      { nested: { cookie: "session=secret" } }, { token: "#token=abc" },
      { url: "https://example.test/file?signature=secret" }, { path: "private/store/file.png" },
      { authorization: "Bearer sk_test_secret" }, { apiKey: "re_very_secret_provider_key" },
    ]) expect(() => assertNoAcceptanceSecrets(leaked)).toThrow();
  });

  it("requires exact grace, signing-failure, and sixth-denial grant state", () => {
    const ids = Array.from({ length: 5 }, () => crypto.randomUUID());
    const base = { kind: "grants", uniqueGrantIds: ids, graceReusedGrantId: ids[0], graceCountBefore: 1, graceCountAfter: 1, signingFailureIssuedIdsBefore: [], signingFailureIssuedIdsAfter: [], signingFailureUsedBefore: 0, signingFailureUsedAfter: 0, releasedFaultGrantId: crypto.randomUUID(), successfulRetryGrantId: ids[0], sixthDeniedStatus: 409, sixthDeniedMessage: "Download limit reached", sessionHashes: Array.from({ length: 6 }, (_, index) => index.toString(16).padStart(64, "0")), assetVersionId: crypto.randomUUID() };
    expect(digitalAcceptanceScenarioEvidenceSchema.parse({ scenario: "five-grants", providerEvidence: base }).scenario).toBe("five-grants");
    expect(() => digitalAcceptanceScenarioEvidenceSchema.parse({ scenario: "five-grants", providerEvidence: { ...base, graceCountAfter: 2 } })).toThrow();
    expect(() => digitalAcceptanceScenarioEvidenceSchema.parse({ scenario: "five-grants", providerEvidence: { ...base, signingFailureUsedAfter: 1 } })).toThrow();
  });

  it("requires correlated checkout, manifest, delivery, and provider identifiers", () => {
    expect(() => digitalAcceptanceObservationSchema.parse({
      version: 1, runId: crypto.randomUUID(), subjectId: crypto.randomUUID(), observedAt: new Date().toISOString(),
      observation: { order: { id: crypto.randomUUID() }, grants: [], notifications: [], manifestItems: [], providerPayment: null },
    })).toThrow();
  });

  it("rejects scenario evidence without its exact provider correlation", () => {
    expect(digitalAcceptanceScenarioEvidenceSchema.parse({
      scenario: "stripe-partial-refund",
      providerEvidence: { kind: "refund", refundId: "re_1", status: "succeeded", amount: 1, paymentIntentId: "pi_1", webhook: { eventId: "evt_1", type: "charge.refunded", signatureVerified: true, status: "processed", receivedAt: new Date().toISOString(), processedAt: new Date().toISOString(), attempts: 1 } },
    }).scenario).toBe("stripe-partial-refund");
    expect(() => digitalAcceptanceScenarioEvidenceSchema.parse({ scenario: "stripe-partial-refund", providerEvidence: { kind: "refund", refundId: "re_1" } })).toThrow();
    expect(() => digitalAcceptanceScenarioEvidenceSchema.parse({ scenario: "resend-access", providerEvidence: { kind: "resend", messageId: "email_1", status: "sent", recipient: "buyer@example.test" } })).toThrow();
    expect(() => digitalAcceptanceScenarioEvidenceSchema.parse({ scenario: "five-grants", providerEvidence: { kind: "grants", uniqueGrantIds: [] } })).toThrow();
  });
});
