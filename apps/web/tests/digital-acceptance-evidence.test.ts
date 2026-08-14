import { describe, expect, it } from "vitest";
import { assertNoAcceptanceSecrets, digitalAcceptanceObservationSchema, digitalAcceptanceScenarioEvidenceSchema, hashAcceptanceSession } from "@/lib/digital-products/acceptance-evidence";

describe("digital acceptance evidence", () => {
  it("rejects null, live-mode, unlinked, or unexpected observations", () => {
    expect(() => digitalAcceptanceObservationSchema.parse({ action: "observe", order: null })).toThrow();
    expect(() => digitalAcceptanceObservationSchema.parse({ action: "observe", orderId: crypto.randomUUID(), storeId: crypto.randomUUID(), payment: { id: "pi_1", status: "succeeded", livemode: true }, delivery: { id: crypto.randomUUID(), status: "succeeded", attemptCount: 1 }, manifestVersionIds: [], grants: [] })).toThrow();
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
    const base = { kind: "grants", uniqueGrantIds: ids, graceReusedGrantId: ids[0], graceCountBefore: 1, graceCountAfter: 1, signingFailureGrantIdsBefore: ids, signingFailureGrantIdsAfter: ids, sixthDeniedStatus: 409, sixthDeniedMessage: "Download limit reached. Contact the store for help.", sessionHashes: Array.from({ length: 6 }, (_, index) => index.toString(16).padStart(64, "0")), assetVersionId: crypto.randomUUID() };
    expect(digitalAcceptanceScenarioEvidenceSchema.parse({ scenario: "five-grants", providerEvidence: base }).scenario).toBe("five-grants");
    expect(() => digitalAcceptanceScenarioEvidenceSchema.parse({ scenario: "five-grants", providerEvidence: { ...base, graceCountAfter: 2 } })).toThrow();
    expect(() => digitalAcceptanceScenarioEvidenceSchema.parse({ scenario: "five-grants", providerEvidence: { ...base, signingFailureGrantIdsAfter: ids.slice(1) } })).toThrow();
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
