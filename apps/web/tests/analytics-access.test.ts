import { describe, expect, test, vi } from "vitest";
import { getStorefrontAnalyticsRolloutConfig, resolveStoreAnalyticsAccessByStoreId, resolveStorePlanAnalyticsFlag } from "@/lib/analytics/access";

describe("analytics access", () => {
  test("reads rollout flags from env defaults", () => {
    const originalCollection = process.env.NEXT_PUBLIC_MYRIVO_STOREFRONT_ANALYTICS_ENABLED;
    const originalDashboard = process.env.MYRIVO_ANALYTICS_DASHBOARD_ENABLED;

    delete process.env.NEXT_PUBLIC_MYRIVO_STOREFRONT_ANALYTICS_ENABLED;
    delete process.env.MYRIVO_ANALYTICS_DASHBOARD_ENABLED;

    expect(getStorefrontAnalyticsRolloutConfig()).toEqual({
      collectionEnabled: true,
      dashboardEnabled: true
    });

    process.env.NEXT_PUBLIC_MYRIVO_STOREFRONT_ANALYTICS_ENABLED = originalCollection;
    process.env.MYRIVO_ANALYTICS_DASHBOARD_ENABLED = originalDashboard;
  });

  test("resolves analytics access from plan flags and rollout switches", async () => {
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: {
              billing_plans: {
                key: "standard",
                feature_flags_json: { analytics: true }
              }
            },
            error: null
          }))
        }))
      }))
    }));

    const access = await resolveStoreAnalyticsAccessByStoreId({ from } as never, "store-1");
    expect(access).toEqual({
      planKey: "standard",
      planAllowsAnalytics: true,
      collectionEnabled: true,
      dashboardEnabled: true
    });
  });

  test("disables analytics when the plan flag is off", () => {
    expect(resolveStorePlanAnalyticsFlag({ analytics: false })).toBe(false);
    expect(resolveStorePlanAnalyticsFlag({ customDomain: true })).toBe(false);
  });

  test("rollout switches can disable collection and dashboard globally", () => {
    const originalCollection = process.env.NEXT_PUBLIC_MYRIVO_STOREFRONT_ANALYTICS_ENABLED;
    const originalDashboard = process.env.MYRIVO_ANALYTICS_DASHBOARD_ENABLED;

    process.env.NEXT_PUBLIC_MYRIVO_STOREFRONT_ANALYTICS_ENABLED = "false";
    process.env.MYRIVO_ANALYTICS_DASHBOARD_ENABLED = "0";

    expect(getStorefrontAnalyticsRolloutConfig()).toEqual({
      collectionEnabled: false,
      dashboardEnabled: false
    });

    process.env.NEXT_PUBLIC_MYRIVO_STOREFRONT_ANALYTICS_ENABLED = originalCollection;
    process.env.MYRIVO_ANALYTICS_DASHBOARD_ENABLED = originalDashboard;
  });
});
