import { buildAlerts } from "@/lib/dashboard/store-dashboard/build-alerts";
import { buildHealthScore } from "@/lib/dashboard/store-dashboard/build-health-score";
import { buildPeriodDelta } from "@/lib/dashboard/store-dashboard/performance-math";
import type { StoreHubData, StoreHubPriorityItem, StoreHubRange, StoreHubStoreRow } from "@/lib/dashboard/store-hub/store-hub-types";
import type { AccessibleStore } from "@/lib/stores/tenant-context";
import type { GlobalUserRole } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type GetStoreHubDataInput = {
  supabase: SupabaseClient;
  stores: AccessibleStore[];
  role: GlobalUserRole;
  range?: StoreHubRange;
  compare?: boolean;
};

type OrderRow = {
  id: string;
  store_id: string;
  total_cents: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  fulfillment_status: "pending_fulfillment" | "packing" | "shipped" | "delivered";
  shipment_status: string | null;
  fulfillment_method: "pickup" | "shipping" | null;
  pickup_window_start_at: string | null;
  created_at: string;
  order_fee_breakdowns?: { platform_fee_cents: number; net_payout_cents: number } | { platform_fee_cents: number; net_payout_cents: number }[] | null;
};

type ProductRow = {
  id: string;
  store_id: string;
  status: "draft" | "active" | "archived";
  inventory_qty: number;
};

type StoreSettingsRow = {
  store_id: string;
  support_email: string | null;
  seo_title: string | null;
  seo_description: string | null;
  checkout_enable_local_pickup: boolean;
  checkout_enable_flat_rate_shipping: boolean;
};

type DomainRow = {
  store_id: string;
  is_primary: boolean;
  verification_status: "pending" | "verified" | "failed";
};

type SubscriberRow = {
  store_id: string;
  status: "subscribed" | "unsubscribed";
  created_at: string;
};

type PromotionRow = {
  store_id: string;
  is_active: boolean;
  times_redeemed: number;
};

type ReviewRow = {
  store_id: string;
  status: "pending" | "published" | "rejected";
};

type AuditRow = {
  id: string;
  store_id: string | null;
  action: string;
  entity: string;
  created_at: string;
};

type InventoryMovementRow = {
  id: string;
  store_id: string;
  delta_qty: number;
  reason: "sale" | "restock" | "adjustment";
  created_at: string;
};

function getRangeStartIso(range: StoreHubRange) {
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

function getFeeBreakdown(order: OrderRow) {
  if (!order.order_fee_breakdowns) {
    return null;
  }
  return Array.isArray(order.order_fee_breakdowns) ? (order.order_fee_breakdowns[0] ?? null) : order.order_fee_breakdowns;
}

function byStoreId<T extends { store_id: string }>(rows: T[] | null | undefined) {
  const map = new Map<string, T[]>();
  for (const row of rows ?? []) {
    const current = map.get(row.store_id) ?? [];
    current.push(row);
    map.set(row.store_id, current);
  }
  return map;
}

function buildActivity(
  storesById: Map<string, AccessibleStore>,
  recentOrders: OrderRow[],
  recentInventory: InventoryMovementRow[],
  recentAudit: AuditRow[]
) {
  const activity: StoreHubData["activity"] = [];

  for (const order of recentOrders.slice(0, 24)) {
    const store = storesById.get(order.store_id);
    if (!store) {
      continue;
    }
    activity.push({
      id: `order:${order.id}`,
      at: order.created_at,
      kind: "order",
      title: `Order ${order.id.slice(0, 8)} ${order.status}`,
      detail: `${store.name} · ${(order.total_cents / 100).toFixed(2)} total`,
      href: `/dashboard/stores/${store.slug}/orders`,
      storeSlug: store.slug
    });
  }

  for (const movement of recentInventory.slice(0, 20)) {
    const store = storesById.get(movement.store_id);
    if (!store) {
      continue;
    }
    activity.push({
      id: `inventory:${movement.id}`,
      at: movement.created_at,
      kind: "inventory",
      title: `Inventory ${movement.reason}`,
      detail: `${store.name} · ${movement.delta_qty > 0 ? "+" : ""}${movement.delta_qty} units`,
      href: `/dashboard/stores/${store.slug}/catalog`,
      storeSlug: store.slug
    });
  }

  for (const event of recentAudit.slice(0, 20)) {
    if (!event.store_id) {
      continue;
    }
    const store = storesById.get(event.store_id);
    if (!store) {
      continue;
    }
    activity.push({
      id: `audit:${event.id}`,
      at: event.created_at,
      kind: "settings",
      title: `${event.action} ${event.entity}`,
      detail: `${store.name} · ${event.action} ${event.entity}`,
      href: `/dashboard/stores/${store.slug}`,
      storeSlug: store.slug
    });
  }

  return activity.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
}

export async function getStoreHubData(input: GetStoreHubDataInput): Promise<StoreHubData> {
  const { supabase, stores, role, compare = false } = input;
  const range = input.range ?? "7d";
  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const rangeStartIso = getRangeStartIso(range);
  const previousRangeStartIso = getPreviousRangeStartIso(rangeStartIso, nowIso);
  const storeIds = stores.map((store) => store.id);

  if (storeIds.length === 0) {
    return {
      role,
      filters: { range, compare, generatedAt: nowIso },
      summary: {
        storesTotal: 0,
        storesActive: 0,
        storesPendingReview: 0,
        storesWithCriticalAlerts: 0,
        pendingFulfillmentTotal: 0,
        grossRevenueCents: 0,
        netPayoutCents: 0,
        paidOrderCount: 0,
        grossRevenueDeltaPct: 0,
        paidOrderDeltaPct: 0
      },
      operations: {
        pendingFulfillment: 0,
        packing: 0,
        overdueFulfillment: 0,
        shippingExceptions: 0,
        pickupDueSoon: 0
      },
      growth: {
        subscribersTotal: 0,
        subscribersNetNew: 0,
        promotionsActive: 0,
        promotionsRedeemed: 0,
        reviewsPending: 0
      },
      approvalQueue: [],
      priorityQueue: [],
      stores: [],
      activity: []
    };
  }

  const [
    { data: storesMeta, error: storesMetaError },
    { data: rangeOrders, error: rangeOrdersError },
    { data: openOrders, error: openOrdersError },
    { data: previousOrders, error: previousOrdersError },
    { data: products, error: productsError },
    { data: settings, error: settingsError },
    { data: domains, error: domainsError },
    { data: subscribers, error: subscribersError },
    { data: promotions, error: promotionsError },
    { data: reviews, error: reviewsError },
    { data: auditEvents, error: auditEventsError },
    { data: inventoryMovements, error: inventoryMovementsError }
  ] = await Promise.all([
    supabase
      .from("stores")
      .select("id,name,slug,status,created_at")
      .in("id", storeIds)
      .returns<Array<{ id: string; name: string; slug: string; status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed"; created_at: string }>>(),
    supabase
      .from("orders")
      .select(
        "id,store_id,total_cents,status,fulfillment_status,shipment_status,fulfillment_method,pickup_window_start_at,created_at,order_fee_breakdowns(platform_fee_cents,net_payout_cents)"
      )
      .in("store_id", storeIds)
      .gte("created_at", rangeStartIso)
      .returns<OrderRow[]>(),
    supabase
      .from("orders")
      .select(
        "id,store_id,total_cents,status,fulfillment_status,shipment_status,fulfillment_method,pickup_window_start_at,created_at,order_fee_breakdowns(platform_fee_cents,net_payout_cents)"
      )
      .in("store_id", storeIds)
      .in("fulfillment_status", ["pending_fulfillment", "packing", "shipped"])
      .gte("created_at", previousRangeStartIso)
      .returns<OrderRow[]>(),
    supabase
      .from("orders")
      .select("id,store_id,total_cents,status")
      .in("store_id", storeIds)
      .gte("created_at", previousRangeStartIso)
      .lt("created_at", rangeStartIso)
      .returns<Array<{ id: string; store_id: string; total_cents: number; status: "pending" | "paid" | "failed" | "cancelled" }>>(),
    supabase
      .from("products")
      .select("id,store_id,status,inventory_qty")
      .in("store_id", storeIds)
      .returns<ProductRow[]>(),
    supabase
      .from("store_settings")
      .select("store_id,support_email,seo_title,seo_description,checkout_enable_local_pickup,checkout_enable_flat_rate_shipping")
      .in("store_id", storeIds)
      .returns<StoreSettingsRow[]>(),
    supabase
      .from("store_domains")
      .select("store_id,is_primary,verification_status")
      .in("store_id", storeIds)
      .returns<DomainRow[]>(),
    supabase
      .from("store_email_subscribers")
      .select("store_id,status,created_at")
      .in("store_id", storeIds)
      .returns<SubscriberRow[]>(),
    supabase
      .from("promotions")
      .select("store_id,is_active,times_redeemed")
      .in("store_id", storeIds)
      .returns<PromotionRow[]>(),
    supabase
      .from("reviews")
      .select("store_id,status")
      .in("store_id", storeIds)
      .returns<ReviewRow[]>(),
    supabase
      .from("audit_events")
      .select("id,store_id,action,entity,created_at")
      .in("store_id", storeIds)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<AuditRow[]>(),
    supabase
      .from("inventory_movements")
      .select("id,store_id,delta_qty,reason,created_at")
      .in("store_id", storeIds)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<InventoryMovementRow[]>()
  ]);

  const firstError = [
    storesMetaError,
    rangeOrdersError,
    openOrdersError,
    previousOrdersError,
    productsError,
    settingsError,
    domainsError,
    subscribersError,
    promotionsError,
    reviewsError,
    auditEventsError,
    inventoryMovementsError
  ].find(Boolean);

  if (firstError) {
    throw new Error(firstError.message);
  }

  const storesMetaById = new Map((storesMeta ?? []).map((row) => [row.id, row]));
  const storesById = new Map(stores.map((store) => [store.id, store]));
  const rangeOrdersByStore = byStoreId(rangeOrders);
  const openOrdersByStore = byStoreId(openOrders);
  const productsByStore = byStoreId(products);
  const settingsByStore = new Map((settings ?? []).map((row) => [row.store_id, row]));
  const domainsByStore = byStoreId(domains);

  const priorityQueue: StoreHubPriorityItem[] = [];
  const storeRows: StoreHubStoreRow[] = [];

  for (const store of stores) {
    const meta = storesMetaById.get(store.id);
    const storeRangeOrders = rangeOrdersByStore.get(store.id) ?? [];
    const storeOpenOrders = openOrdersByStore.get(store.id) ?? [];
    const storeProducts = productsByStore.get(store.id) ?? [];
    const storeSettings = settingsByStore.get(store.id);
    const storeDomains = domainsByStore.get(store.id) ?? [];

    const paidRangeOrders = storeRangeOrders.filter((order) => order.status === "paid");
    const grossRevenueCents = paidRangeOrders.reduce((sum, order) => sum + order.total_cents, 0);
    const netPayoutCents = paidRangeOrders.reduce((sum, order) => {
      const fee = getFeeBreakdown(order);
      return sum + (fee?.net_payout_cents ?? order.total_cents);
    }, 0);

    const pendingFulfillment = storeOpenOrders.filter((order) => order.fulfillment_status === "pending_fulfillment").length;
    const packing = storeOpenOrders.filter((order) => order.fulfillment_status === "packing").length;
    const shippingExceptions = storeOpenOrders.filter((order) => order.shipment_status?.toLowerCase() === "exception").length;
    const overdueFulfillment = storeOpenOrders.filter((order) => {
      if (order.fulfillment_status !== "pending_fulfillment") {
        return false;
      }
      const createdMs = new Date(order.created_at).getTime();
      return nowMs - createdMs > 8 * 60 * 60 * 1000;
    }).length;

    const activeProducts = storeProducts.filter((product) => product.status === "active");
    const lowStockCount = activeProducts.filter((product) => product.inventory_qty > 0 && product.inventory_qty < 10).length;
    const outOfStockCount = activeProducts.filter((product) => product.inventory_qty <= 0).length;

    const hasVerifiedPrimaryDomain = storeDomains.some((domain) => domain.is_primary && domain.verification_status === "verified");
    const hasCheckoutConfigured = Boolean(storeSettings?.checkout_enable_local_pickup || storeSettings?.checkout_enable_flat_rate_shipping);

    const health = buildHealthScore({
      storeSlug: store.slug,
      hasStripeAccount: Boolean(store.stripe_account_id),
      hasVerifiedPrimaryDomain,
      activeProductCount: activeProducts.length,
      hasCheckoutConfigured,
      hasSeoTitle: Boolean(storeSettings?.seo_title?.trim()),
      hasSeoDescription: Boolean(storeSettings?.seo_description?.trim()),
      hasSupportEmail: Boolean(storeSettings?.support_email?.includes("@"))
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

    for (const alert of alerts.slice(0, 3)) {
      priorityQueue.push({
        id: `${store.id}:${alert.id}`,
        severity: alert.severity,
        title: alert.title,
        detail: alert.detail,
        href: alert.actionHref,
        storeSlug: store.slug,
        storeName: store.name
      });
    }

    storeRows.push({
      id: store.id,
      name: store.name,
      slug: store.slug,
      role: store.role,
      status: store.status,
      createdAt: meta?.created_at ?? nowIso,
      pendingFulfillment,
      packing,
      shippingExceptions,
      overdueFulfillment,
      lowStockCount,
      outOfStockCount,
      grossRevenueCents,
      netPayoutCents,
      paidOrderCount: paidRangeOrders.length,
      healthScore: health.score,
      alertCount: alerts.length,
      hasStripeAccount: Boolean(store.stripe_account_id),
      hasVerifiedPrimaryDomain
    });
  }

  const prioritySeverityOrder: Record<StoreHubPriorityItem["severity"], number> = {
    critical: 3,
    high: 2,
    medium: 1
  };
  const sortedPriorityQueue = priorityQueue
    .sort((a, b) => {
      const severityDelta = prioritySeverityOrder[b.severity] - prioritySeverityOrder[a.severity];
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return a.storeName.localeCompare(b.storeName);
    })
    .slice(0, 12);

  const paidOrders = (rangeOrders ?? []).filter((order) => order.status === "paid");
  const previousPaidOrders = (previousOrders ?? []).filter((order) => order.status === "paid");
  const grossRevenueCents = paidOrders.reduce((sum, order) => sum + order.total_cents, 0);
  const netPayoutCents = paidOrders.reduce((sum, order) => {
    const fee = getFeeBreakdown(order as OrderRow);
    return sum + (fee?.net_payout_cents ?? order.total_cents);
  }, 0);
  const avgCurrent = paidOrders.length > 0 ? Math.round(grossRevenueCents / paidOrders.length) : 0;
  const previousGrossRevenueCents = previousPaidOrders.reduce((sum, order) => sum + order.total_cents, 0);
  const avgPrevious = previousPaidOrders.length > 0 ? Math.round(previousGrossRevenueCents / previousPaidOrders.length) : 0;
  const periodDelta = compare
    ? buildPeriodDelta(
        {
          grossRevenueCents,
          orderCount: paidOrders.length,
          avgOrderValueCents: avgCurrent
        },
        {
          grossRevenueCents: previousGrossRevenueCents,
          orderCount: previousPaidOrders.length,
          avgOrderValueCents: avgPrevious
        }
      )
    : null;

  const operationsPendingFulfillment = (openOrders ?? []).filter((order) => order.fulfillment_status === "pending_fulfillment").length;
  const operationsPacking = (openOrders ?? []).filter((order) => order.fulfillment_status === "packing").length;
  const operationsOverdue = (openOrders ?? []).filter((order) => {
    if (order.fulfillment_status !== "pending_fulfillment") {
      return false;
    }
    const createdMs = new Date(order.created_at).getTime();
    return nowMs - createdMs > 8 * 60 * 60 * 1000;
  }).length;
  const operationsShippingExceptions = (openOrders ?? []).filter((order) => order.shipment_status?.toLowerCase() === "exception").length;
  const operationsPickupDueSoon = (openOrders ?? []).filter((order) => {
    if (order.fulfillment_method !== "pickup" || !order.pickup_window_start_at) {
      return false;
    }
    const pickupStartMs = new Date(order.pickup_window_start_at).getTime();
    return pickupStartMs >= nowMs && pickupStartMs <= nowMs + 4 * 60 * 60 * 1000;
  }).length;

  const subscribersRows = subscribers ?? [];
  const subscribersTotal = subscribersRows.filter((row) => row.status === "subscribed").length;
  const subscribersNetNew = subscribersRows.filter((row) => row.status === "subscribed" && row.created_at >= rangeStartIso).length;
  const promotionsRows = promotions ?? [];
  const promotionsActive = promotionsRows.filter((row) => row.is_active).length;
  const promotionsRedeemed = promotionsRows.reduce((sum, row) => sum + row.times_redeemed, 0);
  const reviewsPending = (reviews ?? []).filter((row) => row.status === "pending").length;

  const storesPendingReview = stores.filter((store) => store.status === "pending_review");
  const storesWithCriticalAlerts = storeRows.filter((store) => !store.hasStripeAccount || (store.status === "live" && !store.hasVerifiedPrimaryDomain)).length;

  return {
    role,
    filters: {
      range,
      compare,
      generatedAt: nowIso
    },
    summary: {
      storesTotal: stores.length,
      storesActive: stores.filter((store) => store.status === "live").length,
      storesPendingReview: storesPendingReview.length,
      storesWithCriticalAlerts,
      pendingFulfillmentTotal: operationsPendingFulfillment,
      grossRevenueCents,
      netPayoutCents,
      paidOrderCount: paidOrders.length,
      grossRevenueDeltaPct: periodDelta?.grossRevenuePct ?? null,
      paidOrderDeltaPct: periodDelta?.orderCountPct ?? null
    },
    operations: {
      pendingFulfillment: operationsPendingFulfillment,
      packing: operationsPacking,
      overdueFulfillment: operationsOverdue,
      shippingExceptions: operationsShippingExceptions,
      pickupDueSoon: operationsPickupDueSoon
    },
    growth: {
      subscribersTotal,
      subscribersNetNew,
      promotionsActive,
      promotionsRedeemed,
      reviewsPending
    },
    approvalQueue: storesPendingReview
      .map((store) => ({
        id: store.id,
        name: store.name,
        slug: store.slug,
        createdAt: storesMetaById.get(store.id)?.created_at ?? nowIso
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    priorityQueue: sortedPriorityQueue,
    stores: storeRows.sort((a, b) => {
      if (a.alertCount !== b.alertCount) {
        return b.alertCount - a.alertCount;
      }
      return b.pendingFulfillment - a.pendingFulfillment;
    }),
    activity: buildActivity(storesById, rangeOrders ?? [], inventoryMovements ?? [], auditEvents ?? [])
  };
}
