import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataStat } from "@/components/ui/data-stat";
import { OrderRecord, ProductRecord, StoreRecord } from "@/types/database";

type DashboardOverviewProps = {
  store: Pick<StoreRecord, "id" | "name" | "slug" | "status">;
  recentOrders: Array<
    Pick<OrderRecord, "id" | "total_cents" | "status" | "fulfillment_status" | "shipment_status" | "tracking_number" | "discount_cents" | "created_at">
  >;
  products: Array<
    Pick<
      ProductRecord,
      "id" | "title" | "description" | "sku" | "image_urls" | "is_featured" | "price_cents" | "inventory_qty" | "status" | "created_at"
    >
  >;
};

export function DashboardOverview({ store, products, recentOrders }: DashboardOverviewProps) {
  const lowStockProducts = products.filter((product) => product.inventory_qty < 10 && product.status !== "archived");
  const paidOrders = recentOrders.filter((order) => order.status === "paid");
  const revenueCents = paidOrders.reduce((sum, order) => sum + order.total_cents, 0);
  const avgOrderCents = paidOrders.length > 0 ? Math.round(revenueCents / paidOrders.length) : 0;
  const needsPacking = recentOrders.filter((order) => order.fulfillment_status === "pending_fulfillment").length;
  const inPacking = recentOrders.filter((order) => order.fulfillment_status === "packing").length;
  const inTransit = recentOrders.filter((order) => order.fulfillment_status === "shipped").length;

  return (
    <section className="space-y-5">
      <DashboardPageHeader title="Overview" description={`Performance and operational snapshot for ${store.name}.`} />

      <section className="grid gap-3 sm:grid-cols-3">
        <DataStat label="Recent Revenue" value={`$${(revenueCents / 100).toFixed(2)}`} className="bg-card" />
        <DataStat label="Recent Orders" value={String(recentOrders.length)} className="bg-card" />
        <DataStat label="Low Stock SKUs" value={String(lowStockProducts.length)} className="bg-card" />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <DataStat label="Pending Fulfillment" value={String(needsPacking)} className="bg-card" />
        <DataStat label="Packing Queue" value={String(inPacking)} className="bg-card" />
        <DataStat label="In Transit" value={String(inTransit)} className="bg-card" />
      </section>

      <section className="space-y-2 rounded-lg border border-border/70 bg-card p-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Order Snapshot</h3>
          <p className="text-xs text-muted-foreground">High-level order activity and fulfillment workload at a glance.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <DataStat label="Orders" value={String(recentOrders.length)} className="bg-card" />
          <DataStat label="Paid Orders" value={String(paidOrders.length)} className="bg-card" />
          <DataStat label="Gross" value={`$${(revenueCents / 100).toFixed(2)}`} className="bg-card" />
          <DataStat label="Avg Paid Order" value={`$${(avgOrderCents / 100).toFixed(2)}`} className="bg-card" />
          <DataStat label="To Fulfill" value={String(needsPacking)} className="bg-card" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Recent Orders</CardTitle>
            <CardDescription>Latest paid and pending orders for quick status checks.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {recentOrders.length === 0 ? (
                <li className="text-muted-foreground">No orders yet.</li>
              ) : (
                recentOrders.slice(0, 8).map((order) => (
                  <li key={order.id} className="flex items-center justify-between rounded-md border border-border bg-muted/25 px-3 py-2">
                    <span className="font-mono text-xs">{order.id.slice(0, 8)}</span>
                    <span>${(order.total_cents / 100).toFixed(2)}</span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs">{order.status}</span>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Low Stock Alerts</CardTitle>
            <CardDescription>Active products below your low-stock threshold.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {lowStockProducts.length === 0 ? (
                <li className="text-muted-foreground">No low-stock alerts.</li>
              ) : (
                lowStockProducts.slice(0, 8).map((product) => (
                  <li key={product.id} className="flex items-center justify-between rounded-md border border-border bg-muted/25 px-3 py-2">
                    <span>{product.title}</span>
                    <span className="text-xs text-muted-foreground">{product.inventory_qty} left</span>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </section>

      <InsightsPanel recentOrders={recentOrders} products={products} showLowStockWatchlist={false} title="Performance Insights" />
    </section>
  );
}
