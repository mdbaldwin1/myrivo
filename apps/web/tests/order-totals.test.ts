import { describe, expect, test } from "vitest";
import { calculateOrderTotals, calculatePlatformFeeCents } from "@/lib/orders/calculate-order-totals";

describe("order totals", () => {
  test("calculates fee in cents from basis points", () => {
    expect(calculatePlatformFeeCents(5000, 200)).toBe(100);
    expect(calculatePlatformFeeCents(12345, 50)).toBe(62);
  });

  test("returns consistent totals payload", () => {
    expect(calculateOrderTotals(10000, 150)).toEqual({
      subtotalCents: 10000,
      totalCents: 10000,
      platformFeeBps: 150,
      platformFeeCents: 150
    });
  });
});
