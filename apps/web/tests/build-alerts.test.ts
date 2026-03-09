import { describe, expect, test } from "vitest";
import { buildAlerts } from "@/lib/dashboard/store-dashboard/build-alerts";

describe("buildAlerts", () => {
  test("returns critical and high alerts for blocking conditions", () => {
    const alerts = buildAlerts({
      storeSlug: "my-store",
      storeStatus: "active",
      hasStripeAccount: false,
      hasVerifiedPrimaryDomain: false,
      overdueFulfillment: 3,
      outOfStockCount: 2,
      shippingExceptions: 0
    });

    expect(alerts.map((alert) => alert.id)).toEqual([
      "payments-not-ready",
      "domain-not-verified",
      "overdue-fulfillment",
      "out-of-stock"
    ]);
    expect(alerts[0]?.severity).toBe("critical");
    expect(alerts[1]?.actionHref).toBe("/dashboard/stores/my-store/store-settings/domains");
  });

  test("includes medium shipping exception alert when needed", () => {
    const alerts = buildAlerts({
      storeSlug: "my-store",
      storeStatus: "draft",
      hasStripeAccount: true,
      hasVerifiedPrimaryDomain: false,
      overdueFulfillment: 0,
      outOfStockCount: 0,
      shippingExceptions: 1
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      id: "shipping-exceptions",
      severity: "medium",
      actionHref: "/dashboard/stores/my-store/orders"
    });
  });
});
