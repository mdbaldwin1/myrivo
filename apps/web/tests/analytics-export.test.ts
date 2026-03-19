import { describe, expect, test } from "vitest";
import { buildAnalyticsExportHref, buildCsv, shapeAnalyticsExportRows } from "@/lib/analytics/export";

describe("analytics export shaping", () => {
  test("builds daily analytics export rows and csv output", () => {
    const rows = shapeAnalyticsExportRows({
      dataset: "daily",
      analytics: {
        filters: {
          range: "30d",
          compare: false,
          from: "2026-03-01T00:00:00.000Z",
          to: "2026-03-12T00:00:00.000Z"
        },
        current: {
          sessions: 10,
          pageViews: 22,
          productViews: 8,
          addToCartSessions: 3,
          checkoutStartedSessions: 2,
          paidOrderSessions: 2,
          paidOrders: 2,
          revenueCents: 4800,
          addToCartRate: 0.375,
          checkoutConversionRate: 1
        },
        daily: [
          {
            date: "2026-03-10",
            sessions: 5,
            pageViews: 10,
            productViews: 4,
            addToCart: 2,
            checkoutStarted: 1,
            paidOrders: 1,
            revenueCents: 2400
          }
        ],
        acquisition: {
          externalReferrerSessions: 4,
          campaignTaggedSessions: 3,
          directSessions: 6,
          topReferrers: [],
          topSources: [],
          topMediums: [],
          topCampaigns: []
        }
      },
      merchandising: {
        topPages: [],
        topProducts: [],
        lowConversionProducts: [],
        topSearches: [],
        newsletter: { signups: 0, signupRate: 0 }
      }
    });

    expect(rows[0]).toMatchObject({
      date: "2026-03-10",
      sessions: 5,
      revenue_cents: 2400
    });
    expect(buildCsv(rows)).toContain("date,sessions,page_views");
  });

  test("builds export hrefs for the canonical analytics export route", () => {
    expect(buildAnalyticsExportHref("at-home-apothecary", "30d", "top-products")).toBe(
      "/api/reports/analytics/export?store=at-home-apothecary&range=30d&dataset=top-products"
    );
  });
});
