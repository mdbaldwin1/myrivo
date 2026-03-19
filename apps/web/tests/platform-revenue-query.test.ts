import { describe, expect, test } from "vitest";
import { buildPlatformRevenueSummary } from "@/lib/platform/revenue-query";

describe("platform revenue query", () => {
  test("builds headline totals, top stores, and recent adjustments", () => {
    const summary = buildPlatformRevenueSummary({
      range: "30d",
      since: "2026-02-15T00:00:00.000Z",
      orders: [
        { id: "order-1", store_id: "store-1", total_cents: 10000, currency: "usd", created_at: "2026-03-01T00:00:00Z" },
        { id: "order-2", store_id: "store-2", total_cents: 20000, currency: "usd", created_at: "2026-03-02T00:00:00Z" }
      ],
      fees: [
        { id: "fee-1", order_id: "order-1", store_id: "store-1", subtotal_cents: 9000, platform_fee_cents: 500, net_payout_cents: 8500, created_at: "2026-03-01T00:00:00Z" },
        { id: "fee-2", order_id: "order-2", store_id: "store-2", subtotal_cents: 18000, platform_fee_cents: 1200, net_payout_cents: 16800, created_at: "2026-03-02T00:00:00Z" }
      ],
      refunds: [{ id: "refund-1", order_id: "order-1", store_id: "store-1", amount_cents: 3000, status: "succeeded", created_at: "2026-03-03T00:00:00Z", updated_at: "2026-03-04T00:00:00Z" }],
      disputes: [{ id: "dispute-1", order_id: "order-2", store_id: "store-2", amount_cents: 20000, status: "needs_response", created_at: "2026-03-05T00:00:00Z", currency: "usd", reason: "fraudulent" }],
      stores: [
        { id: "store-1", name: "Olive Mercantile", slug: "olive", status: "live" },
        { id: "store-2", name: "Paper Hearth", slug: "paper", status: "pending_review" }
      ]
    });

    expect(summary.headline.gmvCents).toBe(30000);
    expect(summary.headline.platformFeeCents).toBe(1700);
    expect(summary.headline.netPayoutCents).toBe(25300);
    expect(summary.headline.refundedCents).toBe(3000);
    expect(summary.headline.activeDisputeCount).toBe(1);
    expect(summary.headline.activeDisputeAmountCents).toBe(20000);
    expect(summary.headline.takeRate).toBeCloseTo(1700 / 27000);

    expect(summary.topStores[0]).toMatchObject({
      id: "store-2",
      platformFeeCents: 1200
    });

    expect(summary.recentAdjustments[0]).toMatchObject({
      kind: "dispute",
      orderId: "order-2"
    });
    expect(summary.recentAdjustments[1]).toMatchObject({
      kind: "refund",
      orderId: "order-1"
    });
  });
});
