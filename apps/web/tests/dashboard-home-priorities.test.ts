import { describe, expect, test } from "vitest";
import { buildDashboardHomePriorities } from "@/lib/dashboard/home/get-dashboard-home-data";

describe("buildDashboardHomePriorities", () => {
  test("prioritizes platform approvals first when present", () => {
    const priorities = buildDashboardHomePriorities({
      unreadCount: 3,
      activeCarts: [
        {
          id: "cart-1",
          updatedAt: null,
          storeId: "store-1",
          storeName: "At Home",
          storeSlug: "at-home",
          itemCount: 2,
          subtotalCents: 1299
        }
      ],
      openOrders: [],
      managedStoreCount: 1,
      pendingFulfillmentCount: 4,
      pendingReviewCount: 1,
      platformPendingApprovals: 2
    });

    expect(priorities[0]?.id).toBe("platform-approvals");
    expect(priorities.map((item) => item.id)).toContain("workspace-fulfillment");
    expect(priorities.map((item) => item.id)).toContain("notifications");
  });

  test("returns fallback task when no signals are present", () => {
    const priorities = buildDashboardHomePriorities({
      unreadCount: 0,
      activeCarts: [],
      openOrders: [],
      managedStoreCount: 0,
      pendingFulfillmentCount: 0,
      pendingReviewCount: 0,
      platformPendingApprovals: 0
    });

    expect(priorities).toHaveLength(1);
    expect(priorities[0]?.id).toBe("browse-stores");
  });
});
