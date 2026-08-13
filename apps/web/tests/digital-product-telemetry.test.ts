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
});
