import { describe, expect, test } from "vitest";
import { isChannelEnabledForEvent, resolveAccountNotificationPreferences } from "@/lib/notifications/preferences";

describe("notification preferences", () => {
  test("returns defaults when metadata is missing", () => {
    const preferences = resolveAccountNotificationPreferences(null);
    expect(preferences.weeklyDigestEmails).toBe(true);
    expect(preferences.notificationSoundEnabled).toBe(false);
    expect(preferences.orderAlertsEmail).toBe(true);
    expect(preferences.systemAlertsInApp).toBe(true);
  });

  test("honors explicit account preference values", () => {
    const preferences = resolveAccountNotificationPreferences({
      account_preferences: {
        weeklyDigestEmails: false,
        notificationSoundEnabled: true,
        orderAlertsEmail: false,
        orderAlertsInApp: true,
        systemAlertsInApp: false
      }
    });

    expect(preferences.weeklyDigestEmails).toBe(false);
    expect(preferences.notificationSoundEnabled).toBe(true);
    expect(preferences.orderAlertsEmail).toBe(false);
    expect(preferences.orderAlertsInApp).toBe(true);
    expect(preferences.systemAlertsInApp).toBe(false);
  });

  test("maps event categories to channel preference checks", () => {
    const preferences = resolveAccountNotificationPreferences({
      account_preferences: {
        orderAlertsEmail: false,
        orderAlertsInApp: true,
        weeklyDigestEmails: false
      }
    });

    expect(isChannelEnabledForEvent(preferences, "order.created.owner", "email")).toBe(false);
    expect(isChannelEnabledForEvent(preferences, "order.created.owner", "in_app")).toBe(true);
    expect(isChannelEnabledForEvent(preferences, "digest.weekly", "email")).toBe(false);
  });
});
