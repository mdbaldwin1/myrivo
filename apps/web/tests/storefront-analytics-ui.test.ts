import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { StorefrontAnalyticsFilterBar } from "@/components/dashboard/storefront-analytics-filter-bar";
import { StorefrontAnalyticsFunnelPanel } from "@/components/dashboard/storefront-analytics-funnel-panel";
import { StorefrontAnalyticsTrendPanel } from "@/components/dashboard/storefront-analytics-trend-panel";
import { StorefrontMerchandisingPanel } from "@/components/dashboard/storefront-merchandising-panel";
import { getStorefrontMerchandisingSummary } from "@/lib/analytics/merchandising";
import { buildStorefrontAnalyticsSummary } from "@/lib/analytics/query";

const summary = buildStorefrontAnalyticsSummary({
  range: "30d",
  compare: true,
  currentStart: "2026-02-11T00:00:00.000Z",
  previousStart: "2026-01-12T00:00:00.000Z",
  end: "2026-03-12T23:59:59.000Z",
  sessions: [
    { id: "sess-1", first_seen_at: "2026-03-10T10:00:00.000Z" },
    { id: "sess-2", first_seen_at: "2026-03-11T10:00:00.000Z" }
  ],
  events: [
    { session_id: "sess-1", event_type: "page_view", occurred_at: "2026-03-10T10:01:00.000Z" },
    { session_id: "sess-1", event_type: "product_view", occurred_at: "2026-03-10T10:02:00.000Z" },
    { session_id: "sess-1", event_type: "add_to_cart", occurred_at: "2026-03-10T10:03:00.000Z" },
    { session_id: "sess-1", event_type: "checkout_started", occurred_at: "2026-03-10T10:04:00.000Z" },
    { session_id: "sess-2", event_type: "page_view", occurred_at: "2026-03-11T10:01:00.000Z" },
    { session_id: "sess-2", event_type: "product_view", occurred_at: "2026-03-11T10:02:00.000Z" }
  ],
  orders: [{ analytics_session_id: "sess-1", total_cents: 5200, created_at: "2026-03-10T10:05:00.000Z", status: "paid" }]
});

const merchandising = {
  topPages: [{ path: "/policies?store=at-home-apothecary", views: 14 }],
  topProducts: [{ productId: "prod-1", title: "Lavender Candle", views: 12, addToCart: 4, orders: 2, revenueCents: 3800 }],
  lowConversionProducts: [{ productId: "prod-2", title: "Room Mist", views: 8, orders: 1, conversionRate: 0.125 }],
  topSearches: [{ query: "candle", searches: 6, averageResults: 3.2 }],
  newsletter: { signups: 3, signupRate: 0.15 }
} satisfies Awaited<ReturnType<typeof getStorefrontMerchandisingSummary>>;

describe("storefront analytics dashboard ui", () => {
  test("builds canonical filter links for the analytics route", () => {
    const markup = renderToStaticMarkup(StorefrontAnalyticsFilterBar({ storeSlug: "at-home-apothecary", range: "30d", compare: true }));

    expect(markup).toContain('href="/dashboard/stores/at-home-apothecary/analytics?range=7d"');
    expect(markup).toContain('href="/dashboard/stores/at-home-apothecary/analytics?range=90d"');
    expect(markup).toContain('href="/dashboard/stores/at-home-apothecary/analytics?compare=0"');
  });

  test("renders funnel and trend sections with analytics context", () => {
    const funnelMarkup = renderToStaticMarkup(StorefrontAnalyticsFunnelPanel({ summary }));
    const trendMarkup = renderToStaticMarkup(StorefrontAnalyticsTrendPanel({ summary }));

    expect(funnelMarkup).toContain("Shopper Funnel");
    expect(funnelMarkup).toContain("Started checkout");
    expect(trendMarkup).toContain("Traffic and Revenue Trend");
    expect(trendMarkup).toContain("Revenue");
    expect(trendMarkup).toContain("Mar 10");
  });

  test("renders merchandising actions back into owner workflows", () => {
    const markup = renderToStaticMarkup(
      StorefrontMerchandisingPanel({ storeSlug: "at-home-apothecary", range: "30d", summary: merchandising })
    );

    expect(markup).toContain("/api/reports/analytics/export?store=at-home-apothecary&amp;range=30d&amp;dataset=top-products");
    expect(markup).toContain("/dashboard/stores/at-home-apothecary/catalog?productId=prod-1");
    expect(markup).toContain("/dashboard/stores/at-home-apothecary/storefront-studio?surface=policies");
  });
});
