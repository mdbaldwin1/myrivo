import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
const getOwnedStoreBundleForSlugMock = vi.fn();
const resolveStoreAnalyticsAccessByStoreIdMock = vi.fn();
const getStorefrontAnalyticsSummaryMock = vi.fn();
const getStorefrontMerchandisingSummaryMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args)
    }
  }))
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({}))
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundleForSlug: (...args: unknown[]) => getOwnedStoreBundleForSlugMock(...args)
}));

vi.mock("@/lib/analytics/access", () => ({
  resolveStoreAnalyticsAccessByStoreId: (...args: unknown[]) => resolveStoreAnalyticsAccessByStoreIdMock(...args)
}));

vi.mock("@/lib/analytics/query", () => ({
  getStorefrontAnalyticsSummary: (...args: unknown[]) => getStorefrontAnalyticsSummaryMock(...args)
}));

vi.mock("@/lib/analytics/merchandising", () => ({
  getStorefrontMerchandisingSummary: (...args: unknown[]) => getStorefrontMerchandisingSummaryMock(...args)
}));

beforeEach(() => {
  vi.resetModules();
  getUserMock.mockReset();
  getOwnedStoreBundleForSlugMock.mockReset();
  resolveStoreAnalyticsAccessByStoreIdMock.mockReset();
  getStorefrontAnalyticsSummaryMock.mockReset();
  getStorefrontMerchandisingSummaryMock.mockReset();

  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  getOwnedStoreBundleForSlugMock.mockResolvedValue({
    store: { id: "store-1", slug: "demo-store", name: "Demo Store" }
  });
  resolveStoreAnalyticsAccessByStoreIdMock.mockResolvedValue({
    planKey: "standard",
    planAllowsAnalytics: true,
    collectionEnabled: true,
    dashboardEnabled: true
  });
  getStorefrontAnalyticsSummaryMock.mockResolvedValue({
    filters: { range: "30d", compare: false, from: "2026-03-01T00:00:00.000Z", to: "2026-03-31T00:00:00.000Z" },
    current: {
      sessions: 0,
      pageViews: 0,
      productViews: 0,
      addToCartSessions: 0,
      checkoutStartedSessions: 0,
      paidOrderSessions: 0,
      paidOrders: 0,
      revenueCents: 0,
      addToCartRate: 0,
      checkoutConversionRate: 0
    },
    daily: [],
    deltas: null,
    acquisition: {
      externalReferrerSessions: 0,
      campaignTaggedSessions: 0,
      directSessions: 0,
      topReferrers: [],
      topSources: [],
      topMediums: [],
      topCampaigns: []
    }
  });
  getStorefrontMerchandisingSummaryMock.mockResolvedValue({
    topPages: [],
    topProducts: [],
    lowConversionProducts: [],
    topSearches: [],
    newsletter: { signups: 0, signupRate: 0 }
  });
});

describe("analytics export route", () => {
  test("returns 403 when analytics dashboard access is disabled for the store", async () => {
    resolveStoreAnalyticsAccessByStoreIdMock.mockResolvedValue({
      planKey: "starter",
      planAllowsAnalytics: false,
      collectionEnabled: false,
      dashboardEnabled: false
    });

    const route = await import("@/app/api/reports/analytics/export/route");
    const request = new NextRequest(
      "http://localhost:3000/api/reports/analytics/export?store=demo-store&range=30d&dataset=daily"
    );

    const response = await route.GET(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(payload.error).toContain("not available");
    expect(getStorefrontAnalyticsSummaryMock).not.toHaveBeenCalled();
    expect(getStorefrontMerchandisingSummaryMock).not.toHaveBeenCalled();
  });
});
