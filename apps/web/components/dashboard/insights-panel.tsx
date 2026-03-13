"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OrderRecord, ProductRecord } from "@/types/database";
import { SectionCard } from "@/components/ui/section-card";

type DailyRevenuePoint = {
  date: string;
  revenueCents: number;
  orderCount: number;
};

type InsightsPanelProps = {
  recentOrders: Array<
    Pick<OrderRecord, "id" | "total_cents" | "status" | "fulfillment_status" | "shipment_status" | "tracking_number" | "discount_cents" | "created_at">
  >;
  products: Array<Pick<ProductRecord, "id" | "title" | "inventory_qty" | "status">>;
  showLowStockWatchlist?: boolean;
  title?: string;
};

function buildDailyRevenue(orders: Array<Pick<OrderRecord, "total_cents" | "status" | "created_at">>): DailyRevenuePoint[] {
  const map = new Map<string, DailyRevenuePoint>();

  for (const order of orders) {
    if (order.status !== "paid") {
      continue;
    }

    const date = new Date(order.created_at).toISOString().slice(0, 10);
    const existing = map.get(date);

    if (existing) {
      existing.revenueCents += order.total_cents;
      existing.orderCount += 1;
      continue;
    }

    map.set(date, { date, revenueCents: order.total_cents, orderCount: 1 });
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
}

export function InsightsPanel({ recentOrders, products, showLowStockWatchlist = true, title = "Insights" }: InsightsPanelProps) {
  const dailyRevenue = buildDailyRevenue(recentOrders);
  const dailyRevenueChartData = dailyRevenue.map((point) => ({
    ...point,
    shortDate: point.date.slice(5),
    revenueDollars: point.revenueCents / 100
  }));
  const paidOrders = recentOrders.filter((order) => order.status === "paid");
  const grossCents = paidOrders.reduce((sum, order) => sum + order.total_cents, 0);
  const discountsCents = paidOrders.reduce((sum, order) => sum + order.discount_cents, 0);
  const pendingFulfillmentCount = recentOrders.filter((order) => order.fulfillment_status === "pending_fulfillment").length;
  const packingCount = recentOrders.filter((order) => order.fulfillment_status === "packing").length;
  const shippedCount = recentOrders.filter((order) => order.fulfillment_status === "shipped").length;
  const deliveredCount = recentOrders.filter((order) => order.fulfillment_status === "delivered").length;
  const lowStock = products.filter((product) => product.status === "active" && product.inventory_qty < 10);

  return (
    <SectionCard title={title} description="Revenue, discounts, and stock health for operational planning.">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <article className="rounded-md border border-border bg-muted/25 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid Revenue</p>
            <p className="mt-2 text-2xl font-semibold">${(grossCents / 100).toFixed(2)}</p>
          </article>
          <article className="rounded-md border border-border bg-muted/25 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Discounts Given</p>
            <p className="mt-2 text-2xl font-semibold">${(discountsCents / 100).toFixed(2)}</p>
          </article>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <article className="rounded-md border border-border bg-muted/25 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending Fulfillment</p>
            <p className="mt-2 text-2xl font-semibold">{pendingFulfillmentCount}</p>
          </article>
          <article className="rounded-md border border-border bg-muted/25 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Packing</p>
            <p className="mt-2 text-2xl font-semibold">{packingCount}</p>
          </article>
          <article className="rounded-md border border-border bg-muted/25 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Shipped</p>
            <p className="mt-2 text-2xl font-semibold">{shippedCount}</p>
          </article>
          <article className="rounded-md border border-border bg-muted/25 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Delivered</p>
            <p className="mt-2 text-2xl font-semibold">{deliveredCount}</p>
          </article>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Daily Revenue (14 days)</h3>
          <div className="min-w-0">
            {dailyRevenueChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No paid orders yet.</p>
            ) : (
              <div className="h-64 min-w-0 rounded-md border border-border bg-muted/10 p-3">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                  <BarChart data={dailyRevenueChartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                    <XAxis
                      dataKey="shortDate"
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      className="fill-muted-foreground"
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.28)" }}
                      formatter={(value, _name, item) => [
                        `$${Number(value ?? 0).toFixed(2)} (${item?.payload?.orderCount ?? 0} orders)`,
                        "Revenue"
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Bar dataKey="revenueDollars" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        {showLowStockWatchlist ? (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Low Stock Watchlist</h3>
            <ul className="space-y-1 text-sm">
              {lowStock.length === 0 ? (
                <li className="text-muted-foreground">No urgent low-stock items.</li>
              ) : (
                lowStock.map((product) => (
                  <li key={product.id} className="flex items-center justify-between rounded-md border border-border bg-muted/25 px-3 py-2">
                    <span>{product.title}</span>
                    <span className="text-xs text-muted-foreground">{product.inventory_qty} left</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}
      </div>
    </SectionCard>
  );
}
