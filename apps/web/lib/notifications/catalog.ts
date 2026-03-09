import type { NotificationSeverity } from "@/types/database";

export type NotificationChannelTarget = "in_app" | "email";

export type NotificationCatalogEntry = {
  eventType: string;
  category: "order" | "inventory" | "review" | "system" | "team" | "marketing" | "digest";
  defaultSeverity: NotificationSeverity;
  defaultTargets: NotificationChannelTarget[];
};

const CATALOG: Record<string, NotificationCatalogEntry> = {
  "order.created.owner": {
    eventType: "order.created.owner",
    category: "order",
    defaultSeverity: "info",
    defaultTargets: ["in_app", "email"]
  },
  "order.created.customer": {
    eventType: "order.created.customer",
    category: "order",
    defaultSeverity: "info",
    defaultTargets: ["in_app"]
  },
  "order.fulfillment.shipped": {
    eventType: "order.fulfillment.shipped",
    category: "order",
    defaultSeverity: "info",
    defaultTargets: ["in_app", "email"]
  },
  "order.fulfillment.delivered": {
    eventType: "order.fulfillment.delivered",
    category: "order",
    defaultSeverity: "info",
    defaultTargets: ["in_app", "email"]
  },
  "order.fulfillment.shipped.customer": {
    eventType: "order.fulfillment.shipped.customer",
    category: "order",
    defaultSeverity: "info",
    defaultTargets: ["in_app"]
  },
  "order.fulfillment.delivered.customer": {
    eventType: "order.fulfillment.delivered.customer",
    category: "order",
    defaultSeverity: "info",
    defaultTargets: ["in_app"]
  },
  "order.pickup.updated": {
    eventType: "order.pickup.updated",
    category: "order",
    defaultSeverity: "info",
    defaultTargets: ["in_app", "email"]
  },
  "order.pickup.updated.customer": {
    eventType: "order.pickup.updated.customer",
    category: "order",
    defaultSeverity: "info",
    defaultTargets: ["in_app"]
  },
  "inventory.low_stock": {
    eventType: "inventory.low_stock",
    category: "inventory",
    defaultSeverity: "warning",
    defaultTargets: ["in_app", "email"]
  },
  "inventory.out_of_stock": {
    eventType: "inventory.out_of_stock",
    category: "inventory",
    defaultSeverity: "critical",
    defaultTargets: ["in_app", "email"]
  },
  "review.created.owner": {
    eventType: "review.created.owner",
    category: "review",
    defaultSeverity: "info",
    defaultTargets: ["in_app", "email"]
  },
  "review.low_rating.owner": {
    eventType: "review.low_rating.owner",
    category: "review",
    defaultSeverity: "warning",
    defaultTargets: ["in_app", "email"]
  },
  "review.responded.customer": {
    eventType: "review.responded.customer",
    category: "review",
    defaultSeverity: "info",
    defaultTargets: ["in_app"]
  },
  "review.moderated.customer": {
    eventType: "review.moderated.customer",
    category: "review",
    defaultSeverity: "info",
    defaultTargets: ["in_app"]
  },
  "system.setup.warning": {
    eventType: "system.setup.warning",
    category: "system",
    defaultSeverity: "warning",
    defaultTargets: ["in_app"]
  },
  "store.review.submitted.owner": {
    eventType: "store.review.submitted.owner",
    category: "system",
    defaultSeverity: "info",
    defaultTargets: ["in_app", "email"]
  },
  "store.review.submitted.admin": {
    eventType: "store.review.submitted.admin",
    category: "system",
    defaultSeverity: "info",
    defaultTargets: ["in_app", "email"]
  },
  "store.review.approved.owner": {
    eventType: "store.review.approved.owner",
    category: "system",
    defaultSeverity: "info",
    defaultTargets: ["in_app", "email"]
  },
  "store.review.rejected.owner": {
    eventType: "store.review.rejected.owner",
    category: "system",
    defaultSeverity: "warning",
    defaultTargets: ["in_app", "email"]
  },
  "store.review.suspended.owner": {
    eventType: "store.review.suspended.owner",
    category: "system",
    defaultSeverity: "critical",
    defaultTargets: ["in_app", "email"]
  },
  "legal.update.required": {
    eventType: "legal.update.required",
    category: "system",
    defaultSeverity: "warning",
    defaultTargets: ["in_app", "email"]
  },
  "team.invite.accepted": {
    eventType: "team.invite.accepted",
    category: "team",
    defaultSeverity: "info",
    defaultTargets: ["in_app"]
  },
  "marketing.product_announcement": {
    eventType: "marketing.product_announcement",
    category: "marketing",
    defaultSeverity: "info",
    defaultTargets: ["email"]
  },
  "digest.weekly": {
    eventType: "digest.weekly",
    category: "digest",
    defaultSeverity: "info",
    defaultTargets: ["email"]
  }
};

export function getNotificationCatalogEntry(eventType: string): NotificationCatalogEntry {
  return (
    CATALOG[eventType] ?? {
      eventType,
      category: "system",
      defaultSeverity: "info",
      defaultTargets: ["in_app"]
    }
  );
}
