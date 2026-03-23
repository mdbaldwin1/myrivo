import type { SupabaseClient } from "@supabase/supabase-js";
import { type StorefrontAnalyticsRange } from "@/lib/analytics/query";

type MerchandisingEventRow = {
  event_type: string;
  path: string | null;
  product_id: string | null;
  session_id: string;
  value_json: Record<string, unknown>;
};

type MerchandisingOrderItemRow = {
  product_id: string;
  quantity: number;
  unit_price_cents: number;
  products?: { title: string } | Array<{ title: string }> | null;
};

function resolveProductTitle(product: MerchandisingOrderItemRow["products"], fallback: string) {
  if (!product) {
    return fallback;
  }

  return Array.isArray(product) ? (product[0]?.title ?? fallback) : product.title;
}

export type StorefrontMerchandisingSummary = {
  topPages: Array<{ path: string; views: number }>;
  topProducts: Array<{ productId: string; title: string; views: number; addToCart: number; orders: number; revenueCents: number }>;
  lowConversionProducts: Array<{ productId: string; title: string; views: number; orders: number; conversionRate: number }>;
  topSearches: Array<{ query: string; searches: number; averageResults: number }>;
  newsletter: { signups: number; signupRate: number };
};

function getWindowDays(range: StorefrontAnalyticsRange) {
  return range === "7d" ? 7 : range === "90d" ? 90 : 30;
}

export async function getStorefrontMerchandisingSummary(input: {
  supabase: SupabaseClient;
  storeId: string;
  range?: StorefrontAnalyticsRange;
  now?: Date;
}) {
  const range = input.range ?? "30d";
  const now = input.now ?? new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - (getWindowDays(range) - 1));
  start.setHours(0, 0, 0, 0);

  const eventsQuery = input.supabase
    .from("storefront_events")
    .select("event_type,path,product_id,session_id,value_json")
    .eq("store_id", input.storeId)
    .gte("occurred_at", start.toISOString())
    .lte("occurred_at", now.toISOString());

  const orderItemsQuery = input.supabase
    .from("order_items")
    .select("product_id,quantity,unit_price_cents,products(title),orders!inner(store_id,status,created_at)")
    .eq("orders.store_id", input.storeId)
    .eq("orders.status", "paid")
    .gte("orders.created_at", start.toISOString())
    .lte("orders.created_at", now.toISOString());

  const sessionsQuery = input.supabase
    .from("storefront_sessions")
    .select("id")
    .eq("store_id", input.storeId)
    .gte("first_seen_at", start.toISOString())
    .lte("first_seen_at", now.toISOString());

  const [{ data: events, error: eventsError }, { data: orderItems, error: orderItemsError }, { data: sessionRows, error: sessionsError }] =
    await Promise.all([eventsQuery, orderItemsQuery, sessionsQuery]);

  if (eventsError) {
    throw new Error(eventsError.message);
  }
  if (orderItemsError) {
    throw new Error(orderItemsError.message);
  }
  if (sessionsError) {
    throw new Error(sessionsError.message);
  }

  const pageViews = new Map<string, number>();
  const searches = new Map<string, { searches: number; totalResults: number }>();
  const productStats = new Map<string, { title: string; views: number; addToCart: number; orders: number; revenueCents: number }>();
  let newsletterSignups = 0;

  for (const event of (events ?? []) as MerchandisingEventRow[]) {
    if (event.event_type === "page_view" && event.path) {
      pageViews.set(event.path, (pageViews.get(event.path) ?? 0) + 1);
    }

    if (event.event_type === "newsletter_subscribed") {
      newsletterSignups += 1;
    }

    if (event.event_type === "search_performed") {
      const query = typeof event.value_json.query === "string" ? event.value_json.query : "";
      if (query) {
        const resultCount = typeof event.value_json.resultCount === "number" ? event.value_json.resultCount : 0;
        const current = searches.get(query) ?? { searches: 0, totalResults: 0 };
        current.searches += 1;
        current.totalResults += resultCount;
        searches.set(query, current);
      }
    }

    if (event.product_id && (event.event_type === "product_view" || event.event_type === "add_to_cart")) {
      const current = productStats.get(event.product_id) ?? {
        title: event.product_id,
        views: 0,
        addToCart: 0,
        orders: 0,
        revenueCents: 0
      };
      if (event.event_type === "product_view") {
        current.views += 1;
      }
      if (event.event_type === "add_to_cart") {
        current.addToCart += 1;
      }
      productStats.set(event.product_id, current);
    }
  }

  for (const item of (orderItems ?? []) as MerchandisingOrderItemRow[]) {
    const current = productStats.get(item.product_id) ?? {
      title: resolveProductTitle(item.products, item.product_id),
      views: 0,
      addToCart: 0,
      orders: 0,
      revenueCents: 0
    };
    current.title = resolveProductTitle(item.products, current.title);
    current.orders += item.quantity;
    current.revenueCents += item.quantity * item.unit_price_cents;
    productStats.set(item.product_id, current);
  }

  const totalSessions = (sessionRows ?? []).length;

  return {
    topPages: Array.from(pageViews.entries())
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8),
    topProducts: Array.from(productStats.entries())
      .map(([productId, stats]) => ({ productId, ...stats }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8),
    lowConversionProducts: Array.from(productStats.entries())
      .map(([productId, stats]) => ({
        productId,
        title: stats.title,
        views: stats.views,
        orders: stats.orders,
        conversionRate: stats.views > 0 ? stats.orders / stats.views : 0
      }))
      .filter((product) => product.views >= 3)
      .sort((a, b) => a.conversionRate - b.conversionRate || b.views - a.views)
      .slice(0, 6),
    topSearches: Array.from(searches.entries())
      .map(([query, stats]) => ({
        query,
        searches: stats.searches,
        averageResults: stats.searches > 0 ? stats.totalResults / stats.searches : 0
      }))
      .sort((a, b) => b.searches - a.searches)
      .slice(0, 8),
    newsletter: {
      signups: newsletterSignups,
      signupRate: totalSessions > 0 ? newsletterSignups / totalSessions : 0
    }
  } satisfies StorefrontMerchandisingSummary;
}
