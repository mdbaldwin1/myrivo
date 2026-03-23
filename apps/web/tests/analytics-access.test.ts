import { describe, expect, test, vi } from "vitest";
import { getStorefrontAnalyticsRolloutConfig, resolveStoreAnalyticsAccessByStoreId, resolveStorePlanAnalyticsFlag } from "@/lib/analytics/access";

describe("analytics access", () => {
  test("always enables analytics collection and dashboard when the plan allows it", () => {
    expect(getStorefrontAnalyticsRolloutConfig()).toEqual({
      collectionEnabled: true,
      dashboardEnabled: true
    });
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
});
