import type { StoreStatus } from "@/types/database";

export type StoreDashboardDateRange = "today" | "7d" | "30d";

export type StoreDashboardAlert = {
  id: string;
  severity: "critical" | "high" | "medium";
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
};

export type StoreDashboardNextTask = {
  id: string;
  label: string;
  href: string;
  priority: "critical" | "high" | "medium";
};

export type StoreDashboardHealthCheck = {
  id: string;
  label: string;
  status: "ready" | "action_needed";
  href: string;
  weight: number;
};

export type StoreDashboardData = {
  store: {
    id: string;
    slug: string;
    name: string;
    status: StoreStatus;
  };
  filters: {
    range: StoreDashboardDateRange;
    compare: boolean;
    generatedAt: string;
  };
  alerts: StoreDashboardAlert[];
  operations: {
    pendingFulfillment: number;
    packing: number;
    shippingExceptions: number;
    overdueFulfillment: number;
    duePickupWindows: number;
    nextTasks: StoreDashboardNextTask[];
  };
  performance: {
    grossRevenueCents: number;
    netPayoutCents: number;
    orderCount: number;
    paidOrderCount: number;
    avgOrderValueCents: number;
    discountCents: number;
    periodDelta?: {
      grossRevenuePct: number | null;
      orderCountPct: number | null;
      avgOrderValuePct: number | null;
    };
    dailySeries: Array<{ date: string; grossRevenueCents: number; orders: number }>;
    topProducts: Array<{ productId: string; title: string; revenueCents: number; units: number }>;
  };
  inventory: {
    lowStockCount: number;
    outOfStockCount: number;
    lowStockItems: Array<{ productId: string; title: string; qty: number }>;
    outOfStockItems: Array<{ productId: string; title: string }>;
  };
  growth: {
    subscribersTotal: number;
    subscribersNetNew: number;
    activePromotions: number;
    promotionsRedeemed: number;
  };
  health: {
    score: number;
    checks: StoreDashboardHealthCheck[];
  };
  timeline: Array<{
    id: string;
    at: string;
    kind: "order" | "inventory" | "billing" | "settings" | "domain";
    title: string;
    detail: string;
    href?: string;
  }>;
  moduleErrors?: {
    performance?: string;
    inventory?: string;
    growth?: string;
    timeline?: string;
    health?: string;
  };
};
