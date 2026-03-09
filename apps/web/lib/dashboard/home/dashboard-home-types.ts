import type { GlobalUserRole } from "@/types/database";

export type DashboardHomePriorityItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  severity: "critical" | "high" | "medium";
};

export type DashboardHomeCart = {
  id: string;
  updatedAt: string | null;
  storeId: string;
  storeName: string;
  storeSlug: string;
  itemCount: number;
  subtotalCents: number;
};

export type DashboardHomeOrder = {
  id: string;
  storeName: string | null;
  storeSlug: string | null;
  totalCents: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  fulfillmentStatus: "pending_fulfillment" | "packing" | "shipped" | "delivered";
  trackingUrl: string | null;
  createdAt: string;
};

export type DashboardHomeSavedStore = {
  id: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
};

export type DashboardHomeSavedItem = {
  id: string;
  storeName: string | null;
  storeSlug: string | null;
  productId: string | null;
  productTitle: string | null;
  variantTitle: string | null;
};

export type DashboardHomeNotificationPreview = {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  severity: "info" | "warning" | "critical";
  status: "pending" | "sent" | "failed" | "dismissed" | "read";
  readAt: string | null;
  createdAt: string;
};

export type DashboardHomeWorkspacePulse = {
  managedStoreCount: number;
  pendingFulfillmentCount: number;
  pendingReviewCount: number;
  primaryStoreSlug: string | null;
};

export type DashboardHomePlatformPulse = {
  pendingApprovalCount: number;
};

export type DashboardHomeData = {
  role: GlobalUserRole;
  summary: {
    unreadNotificationCount: number;
    openOrdersCount: number;
    activeCartCount: number;
    managedStoreCount: number;
  };
  priorities: DashboardHomePriorityItem[];
  carts: DashboardHomeCart[];
  orders: {
    open: DashboardHomeOrder[];
    recent: DashboardHomeOrder[];
  };
  savedStores: DashboardHomeSavedStore[];
  savedItems: DashboardHomeSavedItem[];
  notifications: {
    unreadCount: number;
    recent: DashboardHomeNotificationPreview[];
  };
  workspacePulse: DashboardHomeWorkspacePulse | null;
  platformPulse: DashboardHomePlatformPulse | null;
};
