import { describe, expect, test } from "vitest";
import { collectAnalyticsSchema, dedupeEvents, sanitizeSessionId } from "@/lib/analytics/collect";

describe("analytics collect schema", () => {
  test("rejects malformed payload", () => {
    const parsed = collectAnalyticsSchema.safeParse({
      storeSlug: "demo-store",
      events: [{ eventType: "not-real" }]
    });

    expect(parsed.success).toBe(false);
  });

  test("accepts valid payload", () => {
    const parsed = collectAnalyticsSchema.safeParse({
      storeSlug: "demo-store",
      sessionId: "abcd1234abcd1234",
      events: [{ eventType: "page_view", path: "/s/demo-store" }]
    });

    expect(parsed.success).toBe(true);
  });
});

describe("analytics collect helpers", () => {
  test("sanitizeSessionId rejects invalid values", () => {
    expect(sanitizeSessionId("short")).toBeNull();
    expect(sanitizeSessionId("abc def ghi jkl mno pq")).toBeNull();
    expect(sanitizeSessionId("")).toBeNull();
  });

  test("sanitizeSessionId accepts safe tokens", () => {
    expect(sanitizeSessionId("abc_def-1234567890")).toBe("abc_def-1234567890");
  });

  test("dedupeEvents keeps first event per idempotency key", () => {
    const events = dedupeEvents([
      { eventType: "page_view", idempotencyKey: "dup-1", path: "/" },
      { eventType: "page_view", idempotencyKey: "dup-1", path: "/products" },
      { eventType: "product_view", idempotencyKey: "dup-2", path: "/products/a" },
      { eventType: "add_to_cart", path: "/cart" }
    ]);

    expect(events).toHaveLength(3);
    expect(events[0]?.path).toBe("/");
    expect(events[1]?.idempotencyKey).toBe("dup-2");
    expect(events[2]?.eventType).toBe("add_to_cart");
  });
});
