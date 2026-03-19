import { buildAlerts } from "@/lib/dashboard/store-dashboard/build-alerts";
import { buildHealthScore } from "@/lib/dashboard/store-dashboard/build-health-score";
import { buildPeriodDelta } from "@/lib/dashboard/store-dashboard/performance-math";
import type {
  StoreDashboardData,
  StoreDashboardPerformanceView
} from "@/lib/dashboard/store-dashboard/store-dashboard-types";
import type { StoreRecord } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type StoreDashboardStore = Pick<StoreRecord, "id" | "slug" | "name" | "status" | "stripe_account_id">;

type GetStoreDashboardDataInput = {
  supabase: SupabaseClient;
  store: StoreDashboardStore;
  performanceView?: StoreDashboardPerformanceView;
  performanceMonth?: string;
  performanceYear?: number;
};

type DashboardOrderRow = {
  id: string;
  total_cents: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  fulfillment_status: "pending_fulfillment" | "packing" | "shipped" | "delivered";
  shipment_status: string | null;
  discount_cents: number;
  fulfillment_method: "pickup" | "shipping" | null;
  pickup_window_start_at: string | null;
  created_at: string;
  order_fee_breakdowns?: { platform_fee_cents: number; net_payout_cents: number } | { platform_fee_cents: number; net_payout_cents: number }[] | null;
};

type DashboardOrderItemRow = {
  product_id: string;
  quantity: number;
  unit_price_cents: number;
  products?: { title: string } | null;
};

type PerformanceWindow = {
  view: StoreDashboardPerformanceView;
  selectedMonth: string;
  selectedYear: number;
  periodLabel: string;
  seriesGranularity: "day" | "month";
  isCurrentPeriod: boolean;
  currentStartIso: string;
  currentEndIso: string;
  previousStartIso: string;
  previousEndIso: string;
};

function normalizeMonth(rawMonth: string | undefined, fallbackDate: Date) {
  const fallbackMonth = `${fallbackDate.getUTCFullYear()}-${String(fallbackDate.getUTCMonth() + 1).padStart(2, "0")}`;

  if (rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) && rawMonth <= fallbackMonth) {
    return rawMonth;
  }
  return fallbackMonth;
}

function normalizeYear(rawYear: number | undefined, fallbackDate: Date) {
  if (
    typeof rawYear === "number" &&
    Number.isFinite(rawYear) &&
    rawYear >= 2000 &&
    rawYear <= fallbackDate.getUTCFullYear()
  ) {
    return rawYear;
  }
  return fallbackDate.getUTCFullYear();
}

function parseMonthParts(value: string) {
  const [rawYear, rawMonth] = value.split("-");
  const year = Number(rawYear);
  const month = Number(rawMonth);

  return {
    year: Number.isFinite(year) ? year : new Date().getUTCFullYear(),
    month: Number.isFinite(month) ? month : new Date().getUTCMonth() + 1
  };
}

function buildAlignedUtcDate(
  year: number,
  monthIndex: number,
  reference: Date
) {
  const lastDayOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const safeDay = Math.min(reference.getUTCDate(), lastDayOfMonth);

  return new Date(
    Date.UTC(
      year,
      monthIndex,
      safeDay,
      reference.getUTCHours(),
      reference.getUTCMinutes(),
      reference.getUTCSeconds(),
      reference.getUTCMilliseconds()
    )
  );
}

function buildPerformanceWindow(
  view: StoreDashboardPerformanceView,
  rawMonth: string | undefined,
  rawYear: number | undefined
): PerformanceWindow {
  const now = new Date();
  const selectedMonth = normalizeMonth(rawMonth, now);
  const selectedYear = normalizeYear(rawYear, now);
  const currentYear = now.getUTCFullYear();
  const currentMonth = `${currentYear}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  if (view === "year") {
    const currentStart = new Date(Date.UTC(selectedYear, 0, 1, 0, 0, 0, 0));
    const isCurrentPeriod = selectedYear === currentYear;
    const currentEnd = isCurrentPeriod ? now : new Date(Date.UTC(selectedYear + 1, 0, 1, 0, 0, 0, 0));
    const previousStart = new Date(Date.UTC(selectedYear - 1, 0, 1, 0, 0, 0, 0));
    const previousEnd = isCurrentPeriod ? buildAlignedUtcDate(selectedYear - 1, now.getUTCMonth(), now) : new Date(Date.UTC(selectedYear, 0, 1, 0, 0, 0, 0));

    return {
      view,
      selectedMonth,
      selectedYear,
      periodLabel: isCurrentPeriod ? `${selectedYear} YTD` : String(selectedYear),
      seriesGranularity: "month",
      isCurrentPeriod,
      currentStartIso: currentStart.toISOString(),
      currentEndIso: currentEnd.toISOString(),
      previousStartIso: previousStart.toISOString(),
      previousEndIso: previousEnd.toISOString()
    };
  }

  const { year: yearPart, month: monthPart } = parseMonthParts(selectedMonth);
  const currentStart = new Date(Date.UTC(yearPart, monthPart - 1, 1, 0, 0, 0, 0));
  const isCurrentPeriod = selectedMonth === currentMonth;
  const currentEnd = isCurrentPeriod ? now : new Date(Date.UTC(yearPart, monthPart, 1, 0, 0, 0, 0));
  const previousStart = new Date(Date.UTC(yearPart, monthPart - 2, 1, 0, 0, 0, 0));
  const previousEnd = isCurrentPeriod ? buildAlignedUtcDate(yearPart, monthPart - 2, now) : new Date(Date.UTC(yearPart, monthPart - 1, 1, 0, 0, 0, 0));

  return {
    view,
    selectedMonth,
    selectedYear,
    periodLabel: `${currentStart.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}${isCurrentPeriod ? " MTD" : ""}`,
    seriesGranularity: "day",
    isCurrentPeriod,
    currentStartIso: currentStart.toISOString(),
    currentEndIso: currentEnd.toISOString(),
    previousStartIso: previousStart.toISOString(),
    previousEndIso: previousEnd.toISOString()
  };
}

function getFeeBreakdown(order: DashboardOrderRow) {
  if (!order.order_fee_breakdowns) {
    return null;
  }
  return Array.isArray(order.order_fee_breakdowns) ? (order.order_fee_breakdowns[0] ?? null) : order.order_fee_breakdowns;
}

function summarizeOrders(orders: Array<Pick<DashboardOrderRow, "total_cents" | "status">>) {
  const paidOrders = orders.filter((order) => order.status === "paid");
  const grossRevenueCents = paidOrders.reduce((sum, order) => sum + order.total_cents, 0);
  const avgOrderValueCents = paidOrders.length > 0 ? Math.round(grossRevenueCents / paidOrders.length) : 0;

  return {
    paidOrders,
    grossRevenueCents,
    avgOrderValueCents
  };
}

function buildSeries(
  orders: DashboardOrderRow[],
  window: PerformanceWindow
): Array<{ label: string; grossRevenueCents: number; orders: number }> {
  const paidOrders = orders.filter((order) => order.status === "paid");
  const seriesMap = new Map<string, { label: string; grossRevenueCents: number; orders: number }>();

  if (window.seriesGranularity === "month") {
    const lastMonthIndex = window.isCurrentPeriod ? new Date(window.currentEndIso).getUTCMonth() : 11;
    for (let monthIndex = 0; monthIndex <= lastMonthIndex; monthIndex += 1) {
      const date = new Date(Date.UTC(window.selectedYear, monthIndex, 1));
      const key = `${window.selectedYear}-${String(monthIndex + 1).padStart(2, "0")}`;
      seriesMap.set(key, {
        label: date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
        grossRevenueCents: 0,
        orders: 0
      });
    }

    for (const order of paidOrders) {
      const orderDate = new Date(order.created_at);
      const key = `${orderDate.getUTCFullYear()}-${String(orderDate.getUTCMonth() + 1).padStart(2, "0")}`;
      const current = seriesMap.get(key);
      if (current) {
        current.grossRevenueCents += order.total_cents;
        current.orders += 1;
      }
    }

    return Array.from(seriesMap.values());
  }

  const { year: yearPart, month: monthPart } = parseMonthParts(window.selectedMonth);
  const daysInMonth = window.isCurrentPeriod
    ? new Date(window.currentEndIso).getUTCDate()
    : new Date(Date.UTC(yearPart, monthPart, 0)).getUTCDate();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${window.selectedMonth}-${String(day).padStart(2, "0")}`;
    seriesMap.set(key, {
      label: String(day),
      grossRevenueCents: 0,
      orders: 0
    });
  }

  for (const order of paidOrders) {
    const key = new Date(order.created_at).toISOString().slice(0, 10);
    const current = seriesMap.get(key);
    if (current) {
      current.grossRevenueCents += order.total_cents;
      current.orders += 1;
    }
  }

  return Array.from(seriesMap.values());
}

export async function getStoreDashboardData(input: GetStoreDashboardDataInput): Promise<StoreDashboardData> {
  const { supabase, store } = input;
  const performanceView = input.performanceView ?? "month";
  const performanceWindow = buildPerformanceWindow(performanceView, input.performanceMonth, input.performanceYear);
  const operationsLookbackStartIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date();
  const nowMs = now.getTime();

  const [
    { data: recentOrders, error: recentOrdersError },
    { data: performanceOrders, error: performanceOrdersError },
    { data: previousPerformanceOrders, error: previousPerformanceOrdersError },
    { data: products, error: productsError },
    { data: settings, error: settingsError }
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id,total_cents,status,fulfillment_status,shipment_status,discount_cents,fulfillment_method,pickup_window_start_at,created_at,order_fee_breakdowns(platform_fee_cents,net_payout_cents)"
      )
      .eq("store_id", store.id)
      .gte("created_at", operationsLookbackStartIso)
      .order("created_at", { ascending: false })
      .limit(300)
      .returns<DashboardOrderRow[]>(),
    supabase
      .from("orders")
      .select(
        "id,total_cents,status,fulfillment_status,shipment_status,discount_cents,fulfillment_method,pickup_window_start_at,created_at,order_fee_breakdowns(platform_fee_cents,net_payout_cents)"
      )
      .eq("store_id", store.id)
      .gte("created_at", performanceWindow.currentStartIso)
      .lt("created_at", performanceWindow.currentEndIso)
      .order("created_at", { ascending: false })
      .limit(1000)
      .returns<DashboardOrderRow[]>(),
    supabase
      .from("orders")
      .select("id,total_cents,status")
      .eq("store_id", store.id)
      .gte("created_at", performanceWindow.previousStartIso)
      .lt("created_at", performanceWindow.previousEndIso)
      .returns<Array<{ id: string; total_cents: number; status: "pending" | "paid" | "failed" | "cancelled" }>>(),
    supabase
      .from("products")
      .select("id,title,inventory_qty,status")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .returns<Array<{ id: string; title: string; inventory_qty: number; status: "draft" | "active" | "archived" }>>(),
    supabase
      .from("store_settings")
      .select("support_email,seo_title,seo_description,checkout_enable_local_pickup,checkout_enable_flat_rate_shipping")
      .eq("store_id", store.id)
      .maybeSingle<{
        support_email: string | null;
        seo_title: string | null;
        seo_description: string | null;
        checkout_enable_local_pickup: boolean;
        checkout_enable_flat_rate_shipping: boolean;
      }>()
  ]);

  if (recentOrdersError) {
    throw new Error(recentOrdersError.message);
  }
  if (productsError) {
    throw new Error(productsError.message);
  }
  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const [{ data: domains, error: domainsError }, { data: performanceOrderItems, error: performanceOrderItemsError }] = await Promise.all([
    supabase
      .from("store_domains")
      .select("id,is_primary,verification_status")
      .eq("store_id", store.id)
      .returns<Array<{ id: string; is_primary: boolean; verification_status: "pending" | "verified" | "failed" }>>(),
    supabase
      .from("order_items")
      .select("product_id,quantity,unit_price_cents,products(title),orders!inner(store_id,status,created_at)")
      .eq("orders.store_id", store.id)
      .eq("orders.status", "paid")
      .gte("orders.created_at", performanceWindow.currentStartIso)
      .lt("orders.created_at", performanceWindow.currentEndIso)
      .returns<DashboardOrderItemRow[]>()
  ]);

  const moduleErrors: NonNullable<StoreDashboardData["moduleErrors"]> = {};

  const recentOrderRows = recentOrders ?? [];
  const performanceOrderRows = performanceOrders ?? [];
  const productRows = products ?? [];
  const performanceSummary = summarizeOrders(performanceOrderRows);
  const performancePaidOrders = performanceOrderRows.filter((order) => order.status === "paid");
  const grossRevenueCents = performanceSummary.grossRevenueCents;
  const discountCents = performancePaidOrders.reduce((sum, order) => sum + order.discount_cents, 0);
  const netPayoutCents = performancePaidOrders.reduce((sum, order) => {
    const fee = getFeeBreakdown(order);
    return sum + (fee?.net_payout_cents ?? order.total_cents);
  }, 0);

  const pendingFulfillment = recentOrderRows.filter((order) => order.fulfillment_status === "pending_fulfillment").length;
  const packing = recentOrderRows.filter((order) => order.fulfillment_status === "packing").length;
  const shippingExceptions = recentOrderRows.filter((order) => order.shipment_status?.toLowerCase() === "exception").length;
  const overdueFulfillment = recentOrderRows.filter((order) => {
    if (order.fulfillment_status !== "pending_fulfillment") {
      return false;
    }
    const createdMs = new Date(order.created_at).getTime();
    return nowMs - createdMs > 8 * 60 * 60 * 1000;
  }).length;
  const duePickupWindows = recentOrderRows.filter((order) => {
    if (order.fulfillment_method !== "pickup" || !order.pickup_window_start_at) {
      return false;
    }
    const startMs = new Date(order.pickup_window_start_at).getTime();
    return startMs >= nowMs && startMs <= nowMs + 4 * 60 * 60 * 1000;
  }).length;

  const topProductsMap = new Map<string, { productId: string; title: string; revenueCents: number; units: number }>();
  for (const item of (performanceOrderItemsError ? [] : performanceOrderItems) ?? []) {
    const existing = topProductsMap.get(item.product_id);
    const itemRevenue = item.quantity * item.unit_price_cents;
    if (existing) {
      existing.revenueCents += itemRevenue;
      existing.units += item.quantity;
      continue;
    }
    topProductsMap.set(item.product_id, {
      productId: item.product_id,
      title: item.products?.title ?? item.product_id,
      revenueCents: itemRevenue,
      units: item.quantity
    });
  }

  const topProducts = Array.from(topProductsMap.values())
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 5);

  const activeProducts = productRows.filter((product) => product.status === "active");
  const lowStockAll = activeProducts.filter((product) => product.inventory_qty > 0 && product.inventory_qty < 10);
  const outOfStockAll = activeProducts.filter((product) => product.inventory_qty <= 0);

  const hasVerifiedPrimaryDomain = Boolean(((domainsError ? [] : domains) ?? []).some((domain) => domain.is_primary && domain.verification_status === "verified"));
  const hasCheckoutConfigured = Boolean(settings?.checkout_enable_local_pickup || settings?.checkout_enable_flat_rate_shipping);

  const health = buildHealthScore({
    storeSlug: store.slug,
    hasStripeAccount: Boolean(store.stripe_account_id),
    hasVerifiedPrimaryDomain,
    activeProductCount: activeProducts.length,
    hasCheckoutConfigured,
    hasSeoTitle: Boolean(settings?.seo_title?.trim()),
    hasSeoDescription: Boolean(settings?.seo_description?.trim()),
    hasSupportEmail: Boolean(settings?.support_email?.includes("@"))
  });

  const alerts = buildAlerts({
    storeSlug: store.slug,
    storeStatus: store.status,
    hasStripeAccount: Boolean(store.stripe_account_id),
    hasVerifiedPrimaryDomain,
    overdueFulfillment,
    outOfStockCount: outOfStockAll.length,
    shippingExceptions
  });

  const nextTasks = alerts.slice(0, 5).map((alert) => ({
    id: alert.id,
    label: alert.title,
    href: alert.actionHref,
    priority: alert.severity
  }));

  if (nextTasks.length === 0 && pendingFulfillment > 0) {
    nextTasks.push({
      id: "pack-queue",
      label: `Process ${pendingFulfillment} pending fulfillment order(s)`,
      href: `/dashboard/stores/${store.slug}/orders`,
      priority: "medium"
    });
  }

  if (nextTasks.length === 0 && health.score < 100) {
    nextTasks.push({
      id: "improve-readiness",
      label: "Complete store readiness checklist",
      href: `/dashboard/stores/${store.slug}/store-settings/general`,
      priority: "medium"
    });
  }

  const previousSummary = summarizeOrders((previousPerformanceOrdersError ? [] : previousPerformanceOrders) ?? []);
  const periodDelta = buildPeriodDelta(
    {
      grossRevenueCents,
      orderCount: performanceSummary.paidOrders.length,
      avgOrderValueCents: performanceSummary.avgOrderValueCents
    },
    {
      grossRevenueCents: previousSummary.grossRevenueCents,
      orderCount: previousSummary.paidOrders.length,
      avgOrderValueCents: previousSummary.avgOrderValueCents
    }
  );

  if (domainsError) {
    moduleErrors.health = "Some domain health signals are unavailable. Retry to refresh.";
  }
  if (performanceOrdersError || previousPerformanceOrdersError || performanceOrderItemsError) {
    moduleErrors.performance = "Some performance metrics are unavailable. Retry to refresh.";
  }

  return {
    store: {
      id: store.id,
      slug: store.slug,
      name: store.name,
      status: store.status
    },
    filters: {
      performanceView: performanceWindow.view,
      performanceMonth: performanceWindow.selectedMonth,
      performanceYear: performanceWindow.selectedYear,
      generatedAt: new Date().toISOString()
    },
    alerts,
    operations: {
      pendingFulfillment,
      packing,
      shippingExceptions,
      overdueFulfillment,
      duePickupWindows,
      nextTasks
    },
    performance: {
      grossRevenueCents,
      netPayoutCents,
      orderCount: performanceOrderRows.length,
      paidOrderCount: performanceSummary.paidOrders.length,
      avgOrderValueCents: performanceSummary.avgOrderValueCents,
      discountCents,
      view: performanceWindow.view,
      selectedMonth: performanceWindow.selectedMonth,
      selectedYear: performanceWindow.selectedYear,
      periodLabel: performanceWindow.periodLabel,
      seriesGranularity: performanceWindow.seriesGranularity,
      periodDelta,
      series: buildSeries(performanceOrderRows, performanceWindow),
      topProducts
    },
    inventory: {
      lowStockCount: lowStockAll.length,
      outOfStockCount: outOfStockAll.length,
      lowStockItems: lowStockAll.slice(0, 8).map((product) => ({ productId: product.id, title: product.title, qty: product.inventory_qty })),
      outOfStockItems: outOfStockAll.slice(0, 8).map((product) => ({ productId: product.id, title: product.title }))
    },
    health: {
      score: health.score,
      checks: health.checks
    },
    moduleErrors
  };
}
