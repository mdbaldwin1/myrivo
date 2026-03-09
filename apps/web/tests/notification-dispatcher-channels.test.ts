import { describe, expect, test } from "vitest";
import { resolveNotificationChannels } from "@/lib/notifications/dispatcher";
import { resolveAccountNotificationPreferences } from "@/lib/notifications/preferences";

describe("notification dispatcher channels", () => {
  test("uses catalog defaults when channel targets are not overridden", () => {
    const preferences = resolveAccountNotificationPreferences(null);
    const channels = resolveNotificationChannels("order.created.owner", preferences);
    expect(channels).toEqual(["in_app", "email"]);
  });

  test("filters out channels disabled by preferences", () => {
    const preferences = resolveAccountNotificationPreferences({
      account_preferences: {
        inventoryAlertsEmail: false,
        inventoryAlertsInApp: true
      }
    });
    const channels = resolveNotificationChannels("inventory.low_stock", preferences);
    expect(channels).toEqual(["in_app"]);
  });

  test("uses requested channels when provided", () => {
    const preferences = resolveAccountNotificationPreferences(null);
    const channels = resolveNotificationChannels("order.created.owner", preferences, ["email"]);
    expect(channels).toEqual(["email"]);
  });
});
