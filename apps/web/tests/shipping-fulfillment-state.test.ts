import { describe, expect, it } from "vitest";
import { resolveMonotonicFulfillmentStatus, resolveShippedAt } from "@/lib/shipping/provider";

describe("shipping fulfillment monotonic transitions", () => {
  it("does not downgrade delivered order to shipped", () => {
    expect(resolveMonotonicFulfillmentStatus("delivered", "shipped")).toBe("delivered");
  });

  it("advances pending and packing orders to shipped", () => {
    expect(resolveMonotonicFulfillmentStatus("pending_fulfillment", "shipped")).toBe("shipped");
    expect(resolveMonotonicFulfillmentStatus("packing", "shipped")).toBe("shipped");
  });

  it("allows transition to delivered", () => {
    expect(resolveMonotonicFulfillmentStatus("shipped", "delivered")).toBe("delivered");
  });

  it("preserves first shipped timestamp once set", () => {
    const firstShippedAt = "2026-03-07T01:00:00.000Z";
    const laterUpdate = "2026-03-08T15:00:00.000Z";
    expect(resolveShippedAt(firstShippedAt, "shipped", laterUpdate)).toBe(firstShippedAt);
    expect(resolveShippedAt(firstShippedAt, "delivered", laterUpdate)).toBe(firstShippedAt);
  });

  it("sets shipped timestamp when status first reaches shipped", () => {
    const occurredAt = "2026-03-08T15:00:00.000Z";
    expect(resolveShippedAt(null, "shipped", occurredAt)).toBe(occurredAt);
  });
});
