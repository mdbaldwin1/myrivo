import { buildAlerts } from "@/lib/dashboard/store-dashboard/build-alerts";
import { buildHealthScore } from "@/lib/dashboard/store-dashboard/build-health-score";
import { buildPeriodDelta } from "@/lib/dashboard/store-dashboard/performance-math";
import type { StoreDashboardData, StoreDashboardDateRange } from "@/lib/dashboard/store-dashboard/store-dashboard-types";
import type { StoreRecord } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type StoreDashboardStore = Pick<StoreRecord, "id" | "slug" | "name" | "status" | "stripe_account_id">;

type GetStoreDashboardDataInput = {
  supabase: SupabaseClient;
  store: StoreDashboardStore;
  range?: StoreDashboardDateRange;
  compare?: boolean;
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

function getRangeStartIso(range: StoreDashboardDateRange) {
  const now = new Date();
  const start = new Date(now);

  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "7d") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }

  return start.toISOString();
}

function getPreviousRangeStartIso(currentRangeStartIso: string, nowIso: string) {
  const currentStartMs = new Date(currentRangeStartIso).getTime();
  const nowMs = new Date(nowIso).getTime();
  const windowMs = nowMs - currentStartMs;
  return new Date(currentStartMs - windowMs).toISOString();
}

function getFeeBreakdown(order: DashboardOrderRow) {
  if (!order.order_fee_breakdowns) {
    return null;
  }
  return Array.isArray(order.order_fee_breakdowns) ? (order.order_fee_breakdowns[0] ?? null) : order.order_fee_breakdowns;
}

export async function getStoreDashboardData(input: GetStoreDashboardDataInput): Promise<StoreDashboardData> {
  const { supabase, store, compare = false } = input;
  const range = input.range ?? "7d";
  const rangeStartIso = getRangeStartIso(range);
  const now = new Date();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const previousRangeStartIso = getPreviousRangeStartIso(rangeStartIso, nowIso);

  const [{ data: orders, error: ordersError }, { data: products, error: productsError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id,total_cents,status,fulfillment_status,shipment_status,discount_cents,fulfillment_method,pickup_window_start_at,created_at,order_fee_breakdowns(platform_fee_cents,net_payout_cents)"
      )
      .eq("store_id", store.id)
      .gte("created_at", rangeStartIso)
      .order("created_at", { ascending: false })
      .limit(300)
      .returns<DashboardOrderRow[]>(),
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

  if (ordersError) {
    throw new Error(ordersError.message);
  }
  if (productsError) {
    throw new Error(productsError.message);
  }
  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const [
    { data: domains, error: domainsError },
    { data: promotions, error: promotionsError },
    { data: subscribers, error: subscribersError },
    { data: auditEvents, error: auditEventsError },
    { data: billingEvents, error: billingEventsError },
    { data: previousOrders, error: previousOrdersError },
    { data: orderItems, error: orderItemsError },
    { data: inventoryMovements, error: inventoryMovementsError },
    { data: domainEvents, error: domainEventsError }
  ] = await Promise.all([
    supabase
      .from("store_domains")
      .select("id,is_primary,verification_status")
      .eq("store_id", store.id)
      .returns<Array<{ id: string; is_primary: boolean; verification_status: "pending" | "verified" | "failed" }>>(),
    supabase
      .from("promotions")
      .select("id,is_active,times_redeemed")
      .eq("store_id", store.id)
      .returns<Array<{ id: string; is_active: boolean; times_redeemed: number }>>(),
    supabase
      .from("store_email_subscribers")
      .select("id,status,created_at")
      .eq("store_id", store.id)
      .returns<Array<{ id: string; status: "subscribed" | "unsubscribed"; created_at: string }>>(),
    supabase
      .from("audit_events")
      .select("id,action,entity,created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<Array<{ id: string; action: string; entity: string; created_at: string }>>(),
    supabase
      .from("billing_events")
      .select("id,event_type,occurred_at")
      .eq("store_id", store.id)
      .order("occurred_at", { ascending: false })
      .limit(20)
      .returns<Array<{ id: string; event_type: string; occurred_at: string }>>(),
    supabase
      .from("orders")
      .select("id,total_cents,status")
      .eq("store_id", store.id)
      .gte("created_at", previousRangeStartIso)
      .lt("created_at", rangeStartIso)
      .returns<Array<{ id: string; total_cents: number; status: "pending" | "paid" | "failed" | "cancelled" }>>(),
    supabase
      .from("order_items")
      .select("product_id,quantity,unit_price_cents,products(title),orders!inner(store_id,status,created_at)")
      .eq("orders.store_id", store.id)
      .eq("orders.status", "paid")
      .gte("orders.created_at", rangeStartIso)
      .lt("orders.created_at", nowIso)
      .returns<DashboardOrderItemRow[]>(),
    supabase
      .from("inventory_movements")
      .select("id,delta_qty,reason,created_at,products(title)")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<Array<{ id: string; delta_qty: number; reason: string; created_at: string; products?: { title: string } | null }>>(),
    supabase
      .from("store_domains")
      .select("id,domain,verification_status,hosting_status,updated_at")
      .eq("store_id", store.id)
      .order("updated_at", { ascending: false })
      .limit(10)
      .returns<Array<{ id: string; domain: string; verification_status: string; hosting_status: string; updated_at: string }>>()
  ]);

  const moduleErrors: NonNullable<StoreDashboardData["moduleErrors"]> = {};

  const orderRows = orders ?? [];
  const productRows = products ?? [];
  const paidOrders = orderRows.filter((order) => order.status === "paid");
  const grossRevenueCents = paidOrders.reduce((sum, order) => sum + order.total_cents, 0);
  const discountCents = paidOrders.reduce((sum, order) => sum + order.discount_cents, 0);
  const netPayoutCents = paidOrders.reduce((sum, order) => {
    const fee = getFeeBreakdown(order);
    return sum + (fee?.net_payout_cents ?? order.total_cents);
  }, 0);
  const pendingFulfillment = orderRows.filter((order) => order.fulfillment_status === "pending_fulfillment").length;
  const packing = orderRows.filter((order) => order.fulfillment_status === "packing").length;
  const shippingExceptions = orderRows.filter((order) => order.shipment_status?.toLowerCase() === "exception").length;
  const overdueFulfillment = orderRows.filter((order) => {
    if (order.fulfillment_status !== "pending_fulfillment") {
      return false;
    }
    const createdMs = new Date(order.created_at).getTime();
    return nowMs - createdMs > 8 * 60 * 60 * 1000;
  }).length;
  const duePickupWindows = orderRows.filter((order) => {
    if (order.fulfillment_method !== "pickup" || !order.pickup_window_start_at) {
      return false;
    }
    const startMs = new Date(order.pickup_window_start_at).getTime();
    return startMs >= nowMs && startMs <= nowMs + 4 * 60 * 60 * 1000;
  }).length;

  const dailyRevenueMap = new Map<string, { date: string; grossRevenueCents: number; orders: number }>();
  for (const order of paidOrders) {
    const date = new Date(order.created_at).toISOString().slice(0, 10);
    const current = dailyRevenueMap.get(date);
    if (current) {
      current.grossRevenueCents += order.total_cents;
      current.orders += 1;
    } else {
      dailyRevenueMap.set(date, { date, grossRevenueCents: order.total_cents, orders: 1 });
    }
  }
  const dailySeries = Array.from(dailyRevenueMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const topProductsMap = new Map<string, { productId: string; title: string; revenueCents: number; units: number }>();
  for (const item of (orderItemsError ? [] : orderItems) ?? []) {
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
  const lowStockItems = lowStockAll
    .slice(0, 8)
    .map((product) => ({ productId: product.id, title: product.title, qty: product.inventory_qty }));
  const outOfStockAll = activeProducts.filter((product) => product.inventory_qty <= 0);
  const outOfStockCount = outOfStockAll.length;
  const outOfStockItems = outOfStockAll.slice(0, 8).map((product) => ({ productId: product.id, title: product.title }));

  const subscribersRows = (subscribersError ? [] : subscribers) ?? [];
  const subscribersTotal = subscribersRows.filter((entry) => entry.status === "subscribed").length;
  const subscribersRangeTotal = subscribersRows.filter((entry) => {
    const created = new Date(entry.created_at).getTime();
    return entry.status === "subscribed" && created >= new Date(rangeStartIso).getTime();
  }).length;
  const promotionsRows = (promotionsError ? [] : promotions) ?? [];

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
    outOfStockCount,
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

  const previousPaidOrders = ((previousOrdersError ? [] : previousOrders) ?? []).filter((order) => order.status === "paid");
  const previousGrossRevenueCents = previousPaidOrders.reduce((sum, order) => sum + order.total_cents, 0);
  const previousAvgOrderValueCents =
    previousPaidOrders.length > 0 ? Math.round(previousGrossRevenueCents / previousPaidOrders.length) : 0;
  const periodDelta = compare
    ? buildPeriodDelta(
        {
          grossRevenueCents,
          orderCount: paidOrders.length,
          avgOrderValueCents: paidOrders.length > 0 ? Math.round(grossRevenueCents / paidOrders.length) : 0
        },
        {
          grossRevenueCents: previousGrossRevenueCents,
          orderCount: previousPaidOrders.length,
          avgOrderValueCents: previousAvgOrderValueCents
        }
      )
    : undefined;

  const timeline: StoreDashboardData["timeline"] = [
    ...(orderRows.slice(0, 8).map((order) => ({
      id: `order:${order.id}`,
      at: order.created_at,
      kind: "order" as const,
      title: `Order ${order.id.slice(0, 8)}`,
      detail: `${order.status} • ${order.fulfillment_status}`,
      href: `/dashboard/stores/${store.slug}/orders`
    })) ?? []),
    ...(((auditEventsError ? [] : auditEvents) ?? []).map((event) => ({
      id: `audit:${event.id}`,
      at: event.created_at,
      kind: "settings" as const,
      title: event.action,
      detail: event.entity
    })) ?? []),
    ...(((billingEventsError ? [] : billingEvents) ?? []).map((event) => ({
      id: `billing:${event.id}`,
      at: event.occurred_at,
      kind: "billing" as const,
      title: event.event_type,
      detail: "Billing event"
    })) ?? []),
    ...(((inventoryMovementsError ? [] : inventoryMovements) ?? []).map((movement) => ({
      id: `inventory:${movement.id}`,
      at: movement.created_at,
      kind: "inventory" as const,
      title: movement.products?.title ?? "Inventory movement",
      detail: `${movement.reason} • ${movement.delta_qty > 0 ? `+${movement.delta_qty}` : movement.delta_qty}`,
      href: `/dashboard/stores/${store.slug}/reports/inventory`
    })) ?? []),
    ...(((domainEventsError ? [] : domainEvents) ?? []).map((domain) => ({
      id: `domain:${domain.id}`,
      at: domain.updated_at,
      kind: "domain" as const,
      title: domain.domain,
      detail: `verification: ${domain.verification_status} • hosting: ${domain.hosting_status}`,
      href: `/dashboard/stores/${store.slug}/store-settings/domains`
    })) ?? [])
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 30);

  if (domainsError) {
    moduleErrors.health = "Some domain health signals are unavailable. Retry to refresh.";
  }
  if (previousOrdersError || orderItemsError) {
    moduleErrors.performance = "Some performance metrics are unavailable. Retry to refresh.";
  }
  if (promotionsError || subscribersError) {
    moduleErrors.growth = "Growth metrics are temporarily unavailable. Retry to refresh.";
  }
  if (inventoryMovementsError) {
    moduleErrors.inventory = "Inventory movement data is temporarily unavailable. Retry to refresh.";
  }
  if (auditEventsError || billingEventsError || inventoryMovementsError || domainEventsError) {
    moduleErrors.timeline = "Some activity events are unavailable. Retry to refresh.";
  }

  return {
    store: {
      id: store.id,
      slug: store.slug,
      name: store.name,
      status: store.status
    },
    filters: {
      range,
      compare,
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
      orderCount: orderRows.length,
      paidOrderCount: paidOrders.length,
      avgOrderValueCents: paidOrders.length > 0 ? Math.round(grossRevenueCents / paidOrders.length) : 0,
      discountCents,
      periodDelta,
      dailySeries,
      topProducts
    },
    inventory: {
      lowStockCount: lowStockAll.length,
      outOfStockCount,
      lowStockItems,
      outOfStockItems
    },
    growth: {
      subscribersTotal,
      subscribersNetNew: subscribersRangeTotal,
      activePromotions: promotionsRows.filter((promo) => promo.is_active).length,
      promotionsRedeemed: promotionsRows.reduce((sum, promo) => sum + promo.times_redeemed, 0)
    },
    health: {
      score: health.score,
      checks: health.checks
    },
    timeline,
    moduleErrors
  };
}
