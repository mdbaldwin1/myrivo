import type { OrderRecord, ProductRecord } from "@/types/database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  const maxRevenue = Math.max(1, ...dailyRevenue.map((point) => point.revenueCents));
  const paidOrders = recentOrders.filter((order) => order.status === "paid");
  const grossCents = paidOrders.reduce((sum, order) => sum + order.total_cents, 0);
  const discountsCents = paidOrders.reduce((sum, order) => sum + order.discount_cents, 0);
  const pendingFulfillmentCount = recentOrders.filter((order) => order.fulfillment_status === "pending_fulfillment").length;
  const packingCount = recentOrders.filter((order) => order.fulfillment_status === "packing").length;
  const shippedCount = recentOrders.filter((order) => order.fulfillment_status === "shipped").length;
  const deliveredCount = recentOrders.filter((order) => order.fulfillment_status === "delivered").length;
  const lowStock = products.filter((product) => product.status === "active" && product.inventory_qty < 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>Revenue, discounts, and stock health for operational planning.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
        <div className="grid gap-2">
          {dailyRevenue.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paid orders yet.</p>
          ) : (
            dailyRevenue.map((point) => (
              <div key={point.date} className="grid grid-cols-[90px_1fr_120px] items-center gap-2 text-xs">
                <span>{point.date.slice(5)}</span>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${(point.revenueCents / maxRevenue) * 100}%` }} />
                </div>
                <span>
                  ${(point.revenueCents / 100).toFixed(2)} ({point.orderCount})
                </span>
              </div>
            ))
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
      </CardContent>
    </Card>
  );
}
