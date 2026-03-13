import { describe, expect, test } from "vitest";
import { buildStorefrontAnalyticsSummary } from "@/lib/analytics/query";

describe("storefront analytics query reducer", () => {
  test("builds current and previous funnel metrics with comparison deltas", () => {
    const summary = buildStorefrontAnalyticsSummary({
      range: "7d",
      compare: true,
      currentStart: "2026-03-06T00:00:00.000Z",
      previousStart: "2026-02-27T00:00:00.000Z",
      end: "2026-03-12T23:59:59.000Z",
      sessions: [
        { id: "sess-current-1", first_seen_at: "2026-03-10T10:00:00.000Z" },
        { id: "sess-current-2", first_seen_at: "2026-03-11T10:00:00.000Z" },
        { id: "sess-previous-1", first_seen_at: "2026-03-01T10:00:00.000Z" }
      ],
      events: [
        { session_id: "sess-current-1", event_type: "page_view", occurred_at: "2026-03-10T10:01:00.000Z" },
        { session_id: "sess-current-1", event_type: "product_view", occurred_at: "2026-03-10T10:02:00.000Z" },
        { session_id: "sess-current-1", event_type: "add_to_cart", occurred_at: "2026-03-10T10:03:00.000Z" },
        { session_id: "sess-current-1", event_type: "checkout_started", occurred_at: "2026-03-10T10:04:00.000Z" },
        { session_id: "sess-current-2", event_type: "page_view", occurred_at: "2026-03-11T10:01:00.000Z" },
        { session_id: "sess-previous-1", event_type: "page_view", occurred_at: "2026-03-01T10:01:00.000Z" },
        { session_id: "sess-previous-1", event_type: "product_view", occurred_at: "2026-03-01T10:02:00.000Z" }
      ],
      orders: [
        { analytics_session_id: "sess-current-1", total_cents: 3200, created_at: "2026-03-10T10:05:00.000Z", status: "paid" },
        { analytics_session_id: "sess-previous-1", total_cents: 1200, created_at: "2026-03-01T10:05:00.000Z", status: "paid" }
      ]
    });

    expect(summary.current.sessions).toBe(2);
    expect(summary.current.pageViews).toBe(2);
    expect(summary.current.productViews).toBe(1);
    expect(summary.current.addToCartSessions).toBe(1);
    expect(summary.current.checkoutStartedSessions).toBe(1);
    expect(summary.current.paidOrders).toBe(1);
    expect(summary.current.revenueCents).toBe(3200);
    expect(summary.current.addToCartRate).toBe(1);
    expect(summary.current.checkoutConversionRate).toBe(1);
    expect(summary.previous?.sessions).toBe(1);
    expect(summary.previous?.revenueCents).toBe(1200);
    expect(summary.deltas?.revenueCents).toBeGreaterThan(1);
    expect(summary.daily).toHaveLength(2);
  });
});
