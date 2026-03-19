import type { StoreStatus } from "@/types/database";

export type StoreDashboardPerformanceView = "month" | "year";

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
    performanceView: StoreDashboardPerformanceView;
    performanceMonth: string;
    performanceYear: number;
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
    view: StoreDashboardPerformanceView;
    selectedMonth: string;
    selectedYear: number;
    periodLabel: string;
    seriesGranularity: "day" | "month";
    periodDelta?: {
      grossRevenuePct: number | "new" | null;
      orderCountPct: number | "new" | null;
      avgOrderValuePct: number | "new" | null;
    };
    series: Array<{ label: string; grossRevenueCents: number; orders: number }>;
    topProducts: Array<{ productId: string; title: string; revenueCents: number; units: number }>;
  };
  inventory: {
    lowStockCount: number;
    outOfStockCount: number;
    lowStockItems: Array<{ productId: string; title: string; qty: number }>;
    outOfStockItems: Array<{ productId: string; title: string }>;
  };
  health: {
    score: number;
    checks: StoreDashboardHealthCheck[];
  };
  moduleErrors?: {
    performance?: string;
    inventory?: string;
    health?: string;
  };
};
