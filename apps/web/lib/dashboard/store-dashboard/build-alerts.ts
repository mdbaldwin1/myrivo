import type { StoreDashboardAlert } from "@/lib/dashboard/store-dashboard/store-dashboard-types";
import type { StoreStatus } from "@/types/database";

type BuildAlertsInput = {
  storeSlug: string;
  storeStatus: StoreStatus;
  hasStripeAccount: boolean;
  hasVerifiedPrimaryDomain: boolean;
  overdueFulfillment: number;
  outOfStockCount: number;
  shippingExceptions: number;
};

export function buildAlerts(input: BuildAlertsInput): StoreDashboardAlert[] {
  const alerts: StoreDashboardAlert[] = [];

  if (!input.hasStripeAccount) {
    alerts.push({
      id: "payments-not-ready",
      severity: "critical",
      title: "Payments setup incomplete",
      detail: "Stripe Connect is not fully configured for this store.",
      actionLabel: "Finish setup",
      actionHref: `/dashboard/stores/${input.storeSlug}/store-settings/integrations`
    });
  }

  if (input.storeStatus === "live" && !input.hasVerifiedPrimaryDomain) {
    alerts.push({
      id: "domain-not-verified",
      severity: "critical",
      title: "Primary domain is not verified",
      detail: "Your live storefront should have a verified primary domain.",
      actionLabel: "Open domains",
      actionHref: `/dashboard/stores/${input.storeSlug}/store-settings/domains`
    });
  }

  if (input.overdueFulfillment > 0) {
    alerts.push({
      id: "overdue-fulfillment",
      severity: "high",
      title: "Overdue fulfillment queue",
      detail: `${input.overdueFulfillment} order(s) have been pending fulfillment for more than 8 hours.`,
      actionLabel: "Open orders",
      actionHref: `/dashboard/stores/${input.storeSlug}/orders`
    });
  }

  if (input.outOfStockCount > 0) {
    alerts.push({
      id: "out-of-stock",
      severity: "high",
      title: "Active products out of stock",
      detail: `${input.outOfStockCount} active product(s) are at zero inventory.`,
      actionLabel: "Update catalog",
      actionHref: `/dashboard/stores/${input.storeSlug}/catalog`
    });
  }

  if (input.shippingExceptions > 0) {
    alerts.push({
      id: "shipping-exceptions",
      severity: "medium",
      title: "Shipping exceptions detected",
      detail: `${input.shippingExceptions} order(s) have shipment exceptions requiring review.`,
      actionLabel: "Review shipments",
      actionHref: `/dashboard/stores/${input.storeSlug}/orders`
    });
  }

  return alerts;
}
