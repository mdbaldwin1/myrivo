import { describe, expect, test } from "vitest";
import { buildBillingReport, type BillingReportOrder } from "@/lib/billing/reporting";

function makeOrder(overrides: Partial<BillingReportOrder>): BillingReportOrder {
  return {
    id: "order-1",
    status: "paid",
    subtotal_cents: 1000,
    total_cents: 1200,
    currency: "usd",
    created_at: "2026-03-01T00:00:00.000Z",
    order_fee_breakdowns: {
      subtotal_cents: 1000,
      platform_fee_cents: 100,
      net_payout_cents: 900,
      fee_bps: 1000,
      fee_fixed_cents: 0,
      plan_key: "standard"
    },
    ...overrides
  };
}

describe("buildBillingReport", () => {
  test("returns summary totals without issues for healthy orders", () => {
    const report = buildBillingReport([
      makeOrder({ id: "order-1", total_cents: 1200 }),
      makeOrder({
        id: "order-2",
        subtotal_cents: 2000,
        total_cents: 2200,
        order_fee_breakdowns: {
          subtotal_cents: 2000,
          platform_fee_cents: 200,
          net_payout_cents: 1800,
          fee_bps: 1000,
          fee_fixed_cents: 0,
          plan_key: "standard"
        }
      })
    ]);

    expect(report.summary.orderCount).toBe(2);
    expect(report.summary.paidOrderCount).toBe(2);
    expect(report.summary.grossCents).toBe(3400);
    expect(report.summary.platformFeeCents).toBe(300);
    expect(report.summary.netPayoutCents).toBe(2700);
    expect(report.summary.reconciliationIssueCount).toBe(0);
  });

  test("flags missing fee breakdown on paid orders as critical", () => {
    const report = buildBillingReport([makeOrder({ id: "order-3", order_fee_breakdowns: null })]);
    expect(report.summary.reconciliationIssueCount).toBe(1);
    expect(report.issues[0]?.severity).toBe("critical");
  });

  test("flags subtotal mismatches and recomposition mismatches", () => {
    const report = buildBillingReport([
      makeOrder({
        id: "order-4",
        subtotal_cents: 1500,
        order_fee_breakdowns: {
          subtotal_cents: 1400,
          platform_fee_cents: 100,
          net_payout_cents: 1300,
          fee_bps: 714,
          fee_fixed_cents: 0,
          plan_key: "standard"
        }
      }),
      makeOrder({
        id: "order-5",
        order_fee_breakdowns: {
          subtotal_cents: 1000,
          platform_fee_cents: 101,
          net_payout_cents: 890,
          fee_bps: 1000,
          fee_fixed_cents: 0,
          plan_key: "standard"
        }
      })
    ]);

    expect(report.summary.reconciliationIssueCount).toBe(2);
    expect(report.issues.some((entry) => entry.issue.includes("does not match order subtotal"))).toBe(true);
    expect(report.issues.some((entry) => entry.issue.includes("does not match fee subtotal"))).toBe(true);
  });
});
