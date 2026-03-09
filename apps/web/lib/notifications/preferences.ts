import { getNotificationCatalogEntry, type NotificationChannelTarget } from "@/lib/notifications/catalog";

export type AccountNotificationPreferences = {
  weeklyDigestEmails: boolean;
  productAnnouncements: boolean;
  notificationSoundEnabled: boolean;
  orderAlertsEmail: boolean;
  orderAlertsInApp: boolean;
  inventoryAlertsEmail: boolean;
  inventoryAlertsInApp: boolean;
  systemAlertsEmail: boolean;
  systemAlertsInApp: boolean;
  teamAlertsEmail: boolean;
  teamAlertsInApp: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readBoolean(record: Record<string, unknown>, key: string, defaultValue: boolean) {
  const value = record[key];
  return typeof value === "boolean" ? value : defaultValue;
}

export function resolveAccountNotificationPreferences(metadata: Record<string, unknown> | null | undefined): AccountNotificationPreferences {
  const raw = metadata?.account_preferences;
  const preferences = isRecord(raw) ? raw : {};

  return {
    weeklyDigestEmails: readBoolean(preferences, "weeklyDigestEmails", true),
    productAnnouncements: readBoolean(preferences, "productAnnouncements", true),
    notificationSoundEnabled: readBoolean(preferences, "notificationSoundEnabled", false),
    orderAlertsEmail: readBoolean(preferences, "orderAlertsEmail", true),
    orderAlertsInApp: readBoolean(preferences, "orderAlertsInApp", true),
    inventoryAlertsEmail: readBoolean(preferences, "inventoryAlertsEmail", true),
    inventoryAlertsInApp: readBoolean(preferences, "inventoryAlertsInApp", true),
    systemAlertsEmail: readBoolean(preferences, "systemAlertsEmail", true),
    systemAlertsInApp: readBoolean(preferences, "systemAlertsInApp", true),
    teamAlertsEmail: readBoolean(preferences, "teamAlertsEmail", true),
    teamAlertsInApp: readBoolean(preferences, "teamAlertsInApp", true)
  };
}

export function isChannelEnabledForEvent(
  preferences: AccountNotificationPreferences,
  eventType: string,
  channel: NotificationChannelTarget
) {
  const entry = getNotificationCatalogEntry(eventType);
  if (entry.category === "digest") {
    return channel === "email" ? preferences.weeklyDigestEmails : false;
  }
  if (entry.category === "marketing") {
    return channel === "email" ? preferences.productAnnouncements : false;
  }
  if (entry.category === "order") {
    return channel === "email" ? preferences.orderAlertsEmail : preferences.orderAlertsInApp;
  }
  if (entry.category === "inventory") {
    return channel === "email" ? preferences.inventoryAlertsEmail : preferences.inventoryAlertsInApp;
  }
  if (entry.category === "team") {
    return channel === "email" ? preferences.teamAlertsEmail : preferences.teamAlertsInApp;
  }

  return channel === "email" ? preferences.systemAlertsEmail : preferences.systemAlertsInApp;
}
