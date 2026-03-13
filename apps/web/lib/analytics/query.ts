import type { SupabaseClient } from "@supabase/supabase-js";

export type StorefrontAnalyticsRange = "7d" | "30d" | "90d";

type AnalyticsSessionRow = {
  id: string;
  first_seen_at: string;
};

type AnalyticsEventRow = {
  session_id: string;
  event_type: string;
  occurred_at: string;
};

type AnalyticsOrderRow = {
  analytics_session_id: string | null;
  total_cents: number;
  created_at: string;
  status: "pending" | "paid" | "failed" | "cancelled";
};

type AnalyticsBucket = {
  sessions: Set<string>;
  pageViews: number;
  productViews: number;
  addToCartSessions: Set<string>;
  checkoutStartedSessions: Set<string>;
  paidOrderSessions: Set<string>;
  paidOrders: number;
  revenueCents: number;
  byDay: Map<
    string,
    {
      sessions: Set<string>;
      pageViews: number;
      productViews: number;
      addToCart: number;
      checkoutStarted: number;
      paidOrders: number;
      revenueCents: number;
    }
  >;
};

export type StorefrontAnalyticsSummary = {
  filters: {
    range: StorefrontAnalyticsRange;
    compare: boolean;
    from: string;
    to: string;
  };
  current: {
    sessions: number;
    pageViews: number;
    productViews: number;
    addToCartSessions: number;
    checkoutStartedSessions: number;
    paidOrderSessions: number;
    paidOrders: number;
    revenueCents: number;
    addToCartRate: number;
    checkoutConversionRate: number;
  };
  previous?: {
    sessions: number;
    pageViews: number;
    productViews: number;
    addToCartSessions: number;
    checkoutStartedSessions: number;
    paidOrderSessions: number;
    paidOrders: number;
    revenueCents: number;
    addToCartRate: number;
    checkoutConversionRate: number;
  };
  deltas?: {
    sessions: number;
    pageViews: number;
    productViews: number;
    addToCartRate: number;
    checkoutConversionRate: number;
    revenueCents: number;
  };
  daily: Array<{
    date: string;
    sessions: number;
    pageViews: number;
    productViews: number;
    addToCart: number;
    checkoutStarted: number;
    paidOrders: number;
    revenueCents: number;
  }>;
};

function getWindowDays(range: StorefrontAnalyticsRange) {
  if (range === "7d") {
    return 7;
  }
  if (range === "30d") {
    return 30;
  }
  return 90;
}

function getWindow(range: StorefrontAnalyticsRange, compare: boolean, now = new Date()) {
  const windowDays = getWindowDays(range);
  const end = new Date(now);
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - (windowDays - 1));
  currentStart.setHours(0, 0, 0, 0);

  const currentStartMs = currentStart.getTime();
  const endMs = end.getTime();
  const windowMs = endMs - currentStartMs;
  const previousStart = new Date(currentStartMs - windowMs - 1);

  return {
    currentStart,
    previousStart: compare ? previousStart : currentStart,
    end
  };
}

function createBucket(): AnalyticsBucket {
  return {
    sessions: new Set<string>(),
    pageViews: 0,
    productViews: 0,
    addToCartSessions: new Set<string>(),
    checkoutStartedSessions: new Set<string>(),
    paidOrderSessions: new Set<string>(),
    paidOrders: 0,
    revenueCents: 0,
    byDay: new Map()
  };
}

function getDayBucket(bucket: AnalyticsBucket, date: string) {
  const existing = bucket.byDay.get(date);
  if (existing) {
    return existing;
  }

  const created = {
    sessions: new Set<string>(),
    pageViews: 0,
    productViews: 0,
    addToCart: 0,
    checkoutStarted: 0,
    paidOrders: 0,
    revenueCents: 0
  };
  bucket.byDay.set(date, created);
  return created;
}

function toMetricBlock(bucket: AnalyticsBucket) {
  const sessions = bucket.sessions.size;
  const productViews = bucket.productViews;
  const addToCartSessions = bucket.addToCartSessions.size;
  const checkoutStartedSessions = bucket.checkoutStartedSessions.size;
  const paidOrderSessions = bucket.paidOrderSessions.size;

  return {
    sessions,
    pageViews: bucket.pageViews,
    productViews,
    addToCartSessions,
    checkoutStartedSessions,
    paidOrderSessions,
    paidOrders: bucket.paidOrders,
    revenueCents: bucket.revenueCents,
    addToCartRate: productViews > 0 ? addToCartSessions / productViews : 0,
    checkoutConversionRate: checkoutStartedSessions > 0 ? paidOrderSessions / checkoutStartedSessions : 0
  };
}

function roundDelta(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 1;
  }
  return (current - previous) / previous;
}

export function buildStorefrontAnalyticsSummary(input: {
  range: StorefrontAnalyticsRange;
  compare: boolean;
  currentStart: string;
  end: string;
  previousStart?: string;
  sessions: AnalyticsSessionRow[];
  events: AnalyticsEventRow[];
  orders: AnalyticsOrderRow[];
}) {
  const currentStartMs = new Date(input.currentStart).getTime();
  const previousStartMs = new Date(input.previousStart ?? input.currentStart).getTime();
  const endMs = new Date(input.end).getTime();

  const current = createBucket();
  const previous = createBucket();

  const assignBucket = (occurredAt: string) => {
    const timestamp = new Date(occurredAt).getTime();
    if (timestamp >= currentStartMs && timestamp <= endMs) {
      return current;
    }
    if (input.compare && timestamp >= previousStartMs && timestamp < currentStartMs) {
      return previous;
    }
    return null;
  };

  for (const session of input.sessions) {
    const bucket = assignBucket(session.first_seen_at);
    if (!bucket) {
      continue;
    }
    bucket.sessions.add(session.id);
    getDayBucket(bucket, new Date(session.first_seen_at).toISOString().slice(0, 10)).sessions.add(session.id);
  }

  for (const event of input.events) {
    const bucket = assignBucket(event.occurred_at);
    if (!bucket) {
      continue;
    }

    const dayBucket = getDayBucket(bucket, new Date(event.occurred_at).toISOString().slice(0, 10));
    if (event.event_type === "page_view") {
      bucket.pageViews += 1;
      dayBucket.pageViews += 1;
    } else if (event.event_type === "product_view") {
      bucket.productViews += 1;
      dayBucket.productViews += 1;
    } else if (event.event_type === "add_to_cart") {
      bucket.addToCartSessions.add(event.session_id);
      dayBucket.addToCart += 1;
    } else if (event.event_type === "checkout_started") {
      bucket.checkoutStartedSessions.add(event.session_id);
      dayBucket.checkoutStarted += 1;
    }
  }

  for (const order of input.orders) {
    if (order.status !== "paid") {
      continue;
    }

    const bucket = assignBucket(order.created_at);
    if (!bucket) {
      continue;
    }

    bucket.paidOrders += 1;
    bucket.revenueCents += order.total_cents;
    if (order.analytics_session_id) {
      bucket.paidOrderSessions.add(order.analytics_session_id);
    }

    const dayBucket = getDayBucket(bucket, new Date(order.created_at).toISOString().slice(0, 10));
    dayBucket.paidOrders += 1;
    dayBucket.revenueCents += order.total_cents;
  }

  const currentMetrics = toMetricBlock(current);
  const previousMetrics = input.compare ? toMetricBlock(previous) : undefined;

  return {
    filters: {
      range: input.range,
      compare: input.compare,
      from: input.currentStart,
      to: input.end
    },
    current: currentMetrics,
    previous: previousMetrics,
    deltas: previousMetrics
      ? {
          sessions: roundDelta(currentMetrics.sessions, previousMetrics.sessions),
          pageViews: roundDelta(currentMetrics.pageViews, previousMetrics.pageViews),
          productViews: roundDelta(currentMetrics.productViews, previousMetrics.productViews),
          addToCartRate: roundDelta(currentMetrics.addToCartRate, previousMetrics.addToCartRate),
          checkoutConversionRate: roundDelta(currentMetrics.checkoutConversionRate, previousMetrics.checkoutConversionRate),
          revenueCents: roundDelta(currentMetrics.revenueCents, previousMetrics.revenueCents)
        }
      : undefined,
    daily: Array.from(current.byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, day]) => ({
        date,
        sessions: day.sessions.size,
        pageViews: day.pageViews,
        productViews: day.productViews,
        addToCart: day.addToCart,
        checkoutStarted: day.checkoutStarted,
        paidOrders: day.paidOrders,
        revenueCents: day.revenueCents
      }))
  } satisfies StorefrontAnalyticsSummary;
}

export async function getStorefrontAnalyticsSummary(input: {
  supabase: SupabaseClient;
  storeId: string;
  range?: StorefrontAnalyticsRange;
  compare?: boolean;
  now?: Date;
}) {
  const range = input.range ?? "30d";
  const compare = input.compare ?? true;
  const window = getWindow(range, compare, input.now);

  const [{ data: sessions, error: sessionsError }, { data: events, error: eventsError }, { data: orders, error: ordersError }] = await Promise.all([
    input.supabase
      .from("storefront_sessions")
      .select("id,first_seen_at")
      .eq("store_id", input.storeId)
      .gte("first_seen_at", window.previousStart.toISOString())
      .lte("first_seen_at", window.end.toISOString())
      .returns<AnalyticsSessionRow[]>(),
    input.supabase
      .from("storefront_events")
      .select("session_id,event_type,occurred_at")
      .eq("store_id", input.storeId)
      .gte("occurred_at", window.previousStart.toISOString())
      .lte("occurred_at", window.end.toISOString())
      .returns<AnalyticsEventRow[]>(),
    input.supabase
      .from("orders")
      .select("analytics_session_id,total_cents,created_at,status")
      .eq("store_id", input.storeId)
      .gte("created_at", window.previousStart.toISOString())
      .lte("created_at", window.end.toISOString())
      .returns<AnalyticsOrderRow[]>()
  ]);

  if (sessionsError) {
    throw new Error(sessionsError.message);
  }
  if (eventsError) {
    throw new Error(eventsError.message);
  }
  if (ordersError) {
    throw new Error(ordersError.message);
  }

  return buildStorefrontAnalyticsSummary({
    range,
    compare,
    currentStart: window.currentStart.toISOString(),
    previousStart: compare ? window.previousStart.toISOString() : undefined,
    end: window.end.toISOString(),
    sessions: sessions ?? [],
    events: events ?? [],
    orders: orders ?? []
  });
}
