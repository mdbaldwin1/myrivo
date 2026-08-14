import { describe, expect, it } from "vitest";
import { digitalAcceptanceObservationSchema } from "@/lib/digital-products/acceptance-evidence";

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
});
