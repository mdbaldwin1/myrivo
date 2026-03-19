import { describe, expect, test } from "vitest";
import { buildWeeklyDigestBody } from "@/lib/notifications/digest/weekly";

describe("weekly digest", () => {
  test("builds digest body with key KPIs and report link", () => {
    const body = buildWeeklyDigestBody({
      storeName: "Sunset Mercantile",
      storeSlug: "sunset-mercantile",
      windowLabel: "2026-02-23 to 2026-03-01",
      paidOrders: 12,
      paidRevenueCents: 48250,
      pendingFulfillment: 3,
      lowStockItems: 4
    });

    expect(body).toContain("Weekly digest for Sunset Mercantile");
    expect(body).toContain("Paid orders: 12");
    expect(body).toContain("Paid revenue: $482.50");
    expect(body).toContain("Low-stock products: 4");
    expect(body).toContain("/dashboard/stores/sunset-mercantile/reports/insights");
  });
});
