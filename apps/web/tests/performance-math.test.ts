import { describe, expect, test } from "vitest";
import { buildPeriodDelta } from "@/lib/dashboard/store-dashboard/performance-math";

describe("buildPeriodDelta", () => {
  test("returns percentage deltas for non-zero previous values", () => {
    const delta = buildPeriodDelta(
      { grossRevenueCents: 12000, orderCount: 12, avgOrderValueCents: 1000 },
      { grossRevenueCents: 10000, orderCount: 10, avgOrderValueCents: 1000 }
    );

    expect(delta).toEqual({
      grossRevenuePct: 20,
      orderCountPct: 20,
      avgOrderValuePct: 0
    });
  });

  test("returns null when previous value is zero and current is non-zero", () => {
    const delta = buildPeriodDelta(
      { grossRevenueCents: 1000, orderCount: 2, avgOrderValueCents: 500 },
      { grossRevenueCents: 0, orderCount: 0, avgOrderValueCents: 0 }
    );

    expect(delta).toEqual({
      grossRevenuePct: null,
      orderCountPct: null,
      avgOrderValuePct: null
    });
  });

  test("returns 0 when both previous and current values are zero", () => {
    const delta = buildPeriodDelta(
      { grossRevenueCents: 0, orderCount: 0, avgOrderValueCents: 0 },
      { grossRevenueCents: 0, orderCount: 0, avgOrderValueCents: 0 }
    );

    expect(delta).toEqual({
      grossRevenuePct: 0,
      orderCountPct: 0,
      avgOrderValuePct: 0
    });
  });
});
