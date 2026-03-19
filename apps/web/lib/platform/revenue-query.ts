import type { OrderDisputeRecord, OrderFeeBreakdownRecord, OrderRecord, OrderRefundRecord, StoreRecord } from "@/types/database";

export type PlatformRevenueRange = "7d" | "30d" | "90d";

type RevenueOrderRow = Pick<OrderRecord, "id" | "store_id" | "total_cents" | "currency" | "created_at">;
type RevenueFeeRow = Pick<OrderFeeBreakdownRecord, "id" | "order_id" | "store_id" | "subtotal_cents" | "platform_fee_cents" | "net_payout_cents" | "created_at">;
type RevenueRefundRow = Pick<OrderRefundRecord, "id" | "order_id" | "store_id" | "amount_cents" | "status" | "created_at" | "updated_at">;
type RevenueDisputeRow = Pick<OrderDisputeRecord, "id" | "order_id" | "store_id" | "amount_cents" | "status" | "created_at" | "currency" | "reason">;
type RevenueStoreRow = Pick<StoreRecord, "id" | "name" | "slug" | "status">;

type RevenueSummaryInput = {
  orders: RevenueOrderRow[];
  fees: RevenueFeeRow[];
  refunds: RevenueRefundRow[];
  disputes: RevenueDisputeRow[];
  stores: RevenueStoreRow[];
};

export type PlatformRevenueSummary = {
  range: PlatformRevenueRange;
  since: string;
  headline: {
    gmvCents: number;
    platformFeeCents: number;
    netPayoutCents: number;
    refundedCents: number;
    activeDisputeAmountCents: number;
    activeDisputeCount: number;
    ordersCount: number;
    averageOrderValueCents: number;
    takeRate: number;
  };
  topStores: Array<{
    id: string;
    name: string;
    slug: string;
    status: StoreRecord["status"];
    ordersCount: number;
    gmvCents: number;
    platformFeeCents: number;
    netPayoutCents: number;
  }>;
  recentAdjustments: Array<{
    id: string;
    kind: "refund" | "dispute";
    orderId: string;
    store: { id: string; name: string; slug: string; status: StoreRecord["status"] } | null;
    amountCents: number;
    currency: string;
    status: string;
    reason: string | null;
    createdAt: string;
  }>;
};

type QueryResult = Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

export type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  gte: (column: string, value: string) => QueryBuilder;
  in: (column: string, values: string[]) => QueryBuilder;
  returns: () => QueryResult;
};

export function resolveRevenueRange(value: string | string[] | undefined): PlatformRevenueRange {
  return value === "7d" || value === "90d" ? value : "30d";
}

function resolveSince(range: PlatformRevenueRange) {
  const since = new Date();
  if (range === "7d") {
    since.setDate(since.getDate() - 7);
  } else if (range === "90d") {
    since.setDate(since.getDate() - 90);
  } else {
    since.setDate(since.getDate() - 30);
  }
  return since.toISOString();
}

function isActiveDispute(status: OrderDisputeRecord["status"]) {
  return !["won", "lost", "prevented", "warning_closed"].includes(status);
}

export function buildPlatformRevenueSummary(input: RevenueSummaryInput & { range: PlatformRevenueRange; since: string }): PlatformRevenueSummary {
  const storeById = new Map(input.stores.map((store) => [store.id, store]));
  const orderStatsByStoreId = new Map<string, { ordersCount: number; gmvCents: number }>();
  const feeStatsByStoreId = new Map<string, { platformFeeCents: number; netPayoutCents: number }>();

  for (const order of input.orders) {
    const current = orderStatsByStoreId.get(order.store_id) ?? { ordersCount: 0, gmvCents: 0 };
    current.ordersCount += 1;
    current.gmvCents += order.total_cents;
    orderStatsByStoreId.set(order.store_id, current);
  }

  let feeSubtotalCents = 0;
  for (const fee of input.fees) {
    const current = feeStatsByStoreId.get(fee.store_id) ?? { platformFeeCents: 0, netPayoutCents: 0 };
    current.platformFeeCents += fee.platform_fee_cents;
    current.netPayoutCents += fee.net_payout_cents;
    feeStatsByStoreId.set(fee.store_id, current);
    feeSubtotalCents += fee.subtotal_cents;
  }

  const gmvCents = input.orders.reduce((sum, order) => sum + order.total_cents, 0);
  const platformFeeCents = input.fees.reduce((sum, fee) => sum + fee.platform_fee_cents, 0);
  const netPayoutCents = input.fees.reduce((sum, fee) => sum + fee.net_payout_cents, 0);
  const refundedCents = input.refunds.filter((refund) => refund.status === "succeeded").reduce((sum, refund) => sum + refund.amount_cents, 0);
  const activeDisputes = input.disputes.filter((dispute) => isActiveDispute(dispute.status));
  const activeDisputeAmountCents = activeDisputes.reduce((sum, dispute) => sum + dispute.amount_cents, 0);

  const topStores = Array.from(new Set([...orderStatsByStoreId.keys(), ...feeStatsByStoreId.keys()]))
    .map((storeId) => {
      const store = storeById.get(storeId);
      const orderStats = orderStatsByStoreId.get(storeId) ?? { ordersCount: 0, gmvCents: 0 };
      const feeStats = feeStatsByStoreId.get(storeId) ?? { platformFeeCents: 0, netPayoutCents: 0 };
      return {
        id: storeId,
        name: store?.name ?? "Unknown store",
        slug: store?.slug ?? "unknown",
        status: store?.status ?? "draft",
        ordersCount: orderStats.ordersCount,
        gmvCents: orderStats.gmvCents,
        platformFeeCents: feeStats.platformFeeCents,
        netPayoutCents: feeStats.netPayoutCents
      };
    })
    .sort((left, right) => right.platformFeeCents - left.platformFeeCents || right.gmvCents - left.gmvCents)
    .slice(0, 12);

  const recentAdjustments = [
    ...input.refunds.map((refund) => ({
      id: refund.id,
      kind: "refund" as const,
      orderId: refund.order_id,
      store: refund.store_id ? storeById.get(refund.store_id) ?? null : null,
      amountCents: refund.amount_cents,
      currency: "usd",
      status: refund.status,
      reason: null,
      createdAt: refund.updated_at
    })),
    ...input.disputes.map((dispute) => ({
      id: dispute.id,
      kind: "dispute" as const,
      orderId: dispute.order_id,
      store: dispute.store_id ? storeById.get(dispute.store_id) ?? null : null,
      amountCents: dispute.amount_cents,
      currency: dispute.currency,
      status: dispute.status,
      reason: dispute.reason,
      createdAt: dispute.created_at
    }))
  ]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 20)
    .map((item) => ({
      ...item,
      store: item.store ? { id: item.store.id, name: item.store.name, slug: item.store.slug, status: item.store.status } : null
    }));

  return {
    range: input.range,
    since: input.since,
    headline: {
      gmvCents,
      platformFeeCents,
      netPayoutCents,
      refundedCents,
      activeDisputeAmountCents,
      activeDisputeCount: activeDisputes.length,
      ordersCount: input.orders.length,
      averageOrderValueCents: input.orders.length > 0 ? Math.round(gmvCents / input.orders.length) : 0,
      takeRate: feeSubtotalCents > 0 ? platformFeeCents / feeSubtotalCents : 0
    },
    topStores,
    recentAdjustments
  };
}

export async function getPlatformRevenueSummary(input: {
  supabase: {
    from: (table: string) => QueryBuilder;
  };
  range: PlatformRevenueRange;
}) {
  const since = resolveSince(input.range);
  const [{ data: orders, error: ordersError }, { data: fees, error: feesError }, { data: refunds, error: refundsError }, { data: disputes, error: disputesError }] =
    await Promise.all([
      input.supabase
        .from("orders")
        .select("id,store_id,total_cents,currency,created_at")
        .eq("status", "paid")
        .gte("created_at", since)
        .returns(),
      input.supabase
        .from("order_fee_breakdowns")
        .select("id,order_id,store_id,subtotal_cents,platform_fee_cents,net_payout_cents,created_at")
        .gte("created_at", since)
        .returns(),
      input.supabase
        .from("order_refunds")
        .select("id,order_id,store_id,amount_cents,status,created_at,updated_at")
        .gte("created_at", since)
        .returns(),
      input.supabase
        .from("order_disputes")
        .select("id,order_id,store_id,amount_cents,status,created_at,currency,reason")
        .gte("created_at", since)
        .returns()
    ]);

  if (ordersError) {
    throw new Error(ordersError.message);
  }
  if (feesError) {
    throw new Error(feesError.message);
  }
  if (refundsError) {
    throw new Error(refundsError.message);
  }
  if (disputesError) {
    throw new Error(disputesError.message);
  }

  const typedOrders = (orders as RevenueOrderRow[] | null) ?? [];
  const typedFees = (fees as RevenueFeeRow[] | null) ?? [];
  const typedRefunds = (refunds as RevenueRefundRow[] | null) ?? [];
  const typedDisputes = (disputes as RevenueDisputeRow[] | null) ?? [];

  const storeIds = Array.from(
    new Set([
      ...typedOrders.map((order) => order.store_id),
      ...typedFees.map((fee) => fee.store_id),
      ...typedRefunds.map((refund) => refund.store_id),
      ...typedDisputes.map((dispute) => dispute.store_id)
    ])
  );

  const { data: stores, error: storesError } = storeIds.length
    ? ((await input.supabase.from("stores").select("id,name,slug,status").in("id", storeIds).returns()) as {
        data: RevenueStoreRow[] | null;
        error: { message: string } | null;
      })
    : { data: [] as RevenueStoreRow[], error: null };

  if (storesError) {
    throw new Error(storesError.message);
  }

  return buildPlatformRevenueSummary({
    range: input.range,
    since,
    orders: typedOrders,
    fees: typedFees,
    refunds: typedRefunds,
    disputes: typedDisputes,
    stores: stores ?? []
  });
}
