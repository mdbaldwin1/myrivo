import { describe, expect, it, vi } from "vitest";
import { recordDigitalProductEvent } from "@/lib/digital-products/telemetry";

describe("digital product telemetry", () => {
  it("persists only allowlisted dimensions", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const result = await recordDigitalProductEvent({ from: vi.fn(() => ({ insert })) }, {
      eventType: "upload_failed",
      storeId: crypto.randomUUID(),
      dimensions: { stage: "completion", outcome: "failed" },
    });
    expect(result).toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ dimensions: { stage: "completion", outcome: "failed" } }));
  });

  it("rejects PII, tokens, URLs, paths, and unbounded keys before persistence", async () => {
    const insert = vi.fn();
    const client = { from: vi.fn(() => ({ insert })) };
    await expect(recordDigitalProductEvent(client, {
      eventType: "manifest_failed",
      dimensions: { reasonCode: "buyer@example.com" },
    })).rejects.toThrow(/dimension/i);
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([
    ["upload_failed", { stage: "buyer-name", outcome: "failed" }],
    ["manifest_failed", { stage: "checkout_manifest", outcome: "failed", composition: "custom" }],
    ["delivery_job_failed", { outcome: "failed", attemptNumber: -1 }],
    ["delivery_job_aged", { ageBucket: "6m" }],
    ["reconciliation_mismatch", { issueType: "merchant-entered-label" }],
    ["refund_transition", { outcome: "merchant-entered-status" }],
  ] as const)("rejects event-specific free-form or out-of-range dimensions for %s", async (eventType, dimensions) => {
    const insert = vi.fn(async () => ({ error: null }));
    await expect(recordDigitalProductEvent({ from: vi.fn(() => ({ insert })) }, {
      eventType,
      dimensions,
    })).rejects.toThrow(/dimension/i);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects dimensions that belong to a different event", async () => {
    const insert = vi.fn();
    await expect(recordDigitalProductEvent({ from: vi.fn(() => ({ insert })) }, {
      eventType: "download_signing_failed",
      dimensions: { issueType: "token_access_mismatch" },
    })).rejects.toThrow(/dimension/i);
    expect(insert).not.toHaveBeenCalled();
  });
});
