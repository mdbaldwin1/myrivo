import { describe, expect, test } from "vitest";
import { buildStoreSettingsWorkspaceStatuses, storeSettingsWorkspaceGroups } from "@/lib/store-editor/store-settings-workspace";

describe("store settings workspace metadata", () => {
  test("keeps grouped navigation sections available", () => {
    expect(storeSettingsWorkspaceGroups.map((group) => group.title)).toEqual([
      "Identity & reach",
      "Operations & fulfillment",
      "Access & connections"
    ]);
  });

  test("builds section statuses from store health inputs", () => {
    const statuses = buildStoreSettingsWorkspaceStatuses({
      storeStatus: "active",
      hasLogo: true,
      hasVerifiedPrimaryDomain: false,
      paymentsConnected: true,
      shippingEnabled: true,
      pickupEnabled: true,
      pickupLocationCount: 2,
      orderNoteEnabled: false,
      activeMemberCount: 3
    });

    expect(statuses.overview).toBe("Live");
    expect(statuses.branding).toBe("Brand assets configured");
    expect(statuses.pickup).toBe("2 active pickup locations");
    expect(statuses.integrations).toBe("Payments connected");
  });
});
