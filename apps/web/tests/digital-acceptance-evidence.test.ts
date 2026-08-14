import { describe, expect, it } from "vitest";
import { digitalAcceptanceObservationSchema, digitalAcceptanceScenarioEvidenceSchema } from "@/lib/digital-products/acceptance-evidence";

describe("digital acceptance evidence", () => {
  it("rejects null, live-mode, unlinked, or unexpected observations", () => {
    expect(() => digitalAcceptanceObservationSchema.parse({ action: "observe", order: null })).toThrow();
    expect(() => digitalAcceptanceObservationSchema.parse({ action: "observe", orderId: crypto.randomUUID(), storeId: crypto.randomUUID(), payment: { id: "pi_1", status: "succeeded", livemode: true }, delivery: { id: crypto.randomUUID(), status: "succeeded", attemptCount: 1 }, manifestVersionIds: [], grants: [] })).toThrow();
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
