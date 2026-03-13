import type { StorefrontMerchandisingSummary } from "@/lib/analytics/merchandising";
import type { StorefrontAnalyticsRange, StorefrontAnalyticsSummary } from "@/lib/analytics/query";

export type AnalyticsExportDataset = "daily" | "top-pages" | "top-products" | "low-conversion-products" | "top-searches";

type ExportRow = Record<string, string | number>;

function escapeCsv(value: string | number) {
  const normalized = String(value);
  if (normalized.includes(",") || normalized.includes("\"") || normalized.includes("\n")) {
    return `"${normalized.replaceAll("\"", "\"\"")}"`;
  }
  return normalized;
}

export function buildCsv(rows: ExportRow[]) {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0] ?? {});
  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header] ?? "")).join(","));
  }

  return lines.join("\n");
}

export function buildAnalyticsExportHref(storeSlug: string, range: StorefrontAnalyticsRange, dataset: AnalyticsExportDataset) {
  const searchParams = new URLSearchParams({
    store: storeSlug,
    range,
    dataset
  });

  return `/api/reports/analytics/export?${searchParams.toString()}`;
}

export function shapeAnalyticsExportRows(input: {
  dataset: AnalyticsExportDataset;
  analytics: StorefrontAnalyticsSummary;
  merchandising: StorefrontMerchandisingSummary;
}) {
  if (input.dataset === "daily") {
    return input.analytics.daily.map((row) => ({
      date: row.date,
      sessions: row.sessions,
      page_views: row.pageViews,
      product_views: row.productViews,
      add_to_cart: row.addToCart,
      checkout_started: row.checkoutStarted,
      paid_orders: row.paidOrders,
      revenue_cents: row.revenueCents
    }));
  }

  if (input.dataset === "top-pages") {
    return input.merchandising.topPages.map((row) => ({
      path: row.path,
      views: row.views
    }));
  }

  if (input.dataset === "top-products") {
    return input.merchandising.topProducts.map((row) => ({
      product_id: row.productId,
      title: row.title,
      views: row.views,
      add_to_cart: row.addToCart,
      orders: row.orders,
      revenue_cents: row.revenueCents
    }));
  }

  if (input.dataset === "low-conversion-products") {
    return input.merchandising.lowConversionProducts.map((row) => ({
      product_id: row.productId,
      title: row.title,
      views: row.views,
      orders: row.orders,
      conversion_rate: row.conversionRate
    }));
  }

  return input.merchandising.topSearches.map((row) => ({
    query: row.query,
    searches: row.searches,
    average_results: row.averageResults
  }));
}
