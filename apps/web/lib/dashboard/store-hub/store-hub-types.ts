import type { GlobalUserRole, StoreStatus } from "@/types/database";

export type StoreHubRange = "today" | "7d" | "30d";

export type StoreHubPriorityItem = {
  id: string;
  severity: "critical" | "high" | "medium";
  title: string;
  detail: string;
  href: string;
  storeSlug: string;
  storeName: string;
};

export type StoreHubStoreRow = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "staff" | "customer" | "support";
  status: StoreStatus;
  createdAt: string;
  pendingFulfillment: number;
  packing: number;
  shippingExceptions: number;
  overdueFulfillment: number;
  lowStockCount: number;
  outOfStockCount: number;
  grossRevenueCents: number;
  netPayoutCents: number;
  paidOrderCount: number;
  healthScore: number;
  alertCount: number;
  hasStripeAccount: boolean;
  hasVerifiedPrimaryDomain: boolean;
};

export type StoreHubActivityItem = {
  id: string;
  at: string;
  kind: "order" | "inventory" | "settings";
  title: string;
  detail: string;
  href: string;
  storeSlug: string;
};

export type StoreHubData = {
  role: GlobalUserRole;
  filters: {
    range: StoreHubRange;
    compare: boolean;
    generatedAt: string;
  };
  summary: {
    storesTotal: number;
    storesActive: number;
    storesPendingReview: number;
    storesWithCriticalAlerts: number;
    pendingFulfillmentTotal: number;
    grossRevenueCents: number;
    netPayoutCents: number;
    paidOrderCount: number;
    grossRevenueDeltaPct: number | "new" | null;
    paidOrderDeltaPct: number | "new" | null;
  };
  operations: {
    pendingFulfillment: number;
    packing: number;
    overdueFulfillment: number;
    shippingExceptions: number;
    pickupDueSoon: number;
  };
  growth: {
    subscribersTotal: number;
    subscribersNetNew: number;
    promotionsActive: number;
    promotionsRedeemed: number;
    reviewsPending: number;
  };
  approvalQueue: Array<{
    id: string;
    name: string;
    slug: string;
    createdAt: string;
  }>;
  priorityQueue: StoreHubPriorityItem[];
  stores: StoreHubStoreRow[];
  activity: StoreHubActivityItem[];
};
