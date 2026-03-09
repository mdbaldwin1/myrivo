import Link from "next/link";
import { AppAlert } from "@/components/ui/app-alert";
import { SectionCard } from "@/components/ui/section-card";
import type { StoreDashboardData } from "@/lib/dashboard/store-dashboard/store-dashboard-types";

type InventoryRiskPanelProps = {
  inventory: StoreDashboardData["inventory"];
  storeSlug: string;
  errorMessage?: string;
  retryHref: string;
};

export function InventoryRiskPanel({ inventory, storeSlug, errorMessage, retryHref }: InventoryRiskPanelProps) {
  return (
    <SectionCard
      title="Inventory Risk"
      description="Out-of-stock and low-stock products that may impact sales."
      action={
        <Link href={`/dashboard/stores/${storeSlug}/catalog`} className="text-xs font-medium text-primary hover:underline">
          Open catalog
        </Link>
      }
    >
      <div className="space-y-4">
        <AppAlert
          variant="warning"
          message={errorMessage ?? null}
          action={
            <Link href={retryHref} className="text-xs font-medium underline">
              Retry
            </Link>
          }
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <article className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Out of Stock</p>
            <p className="mt-1 text-xl font-semibold">{inventory.outOfStockCount}</p>
          </article>
          <article className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Low Stock</p>
            <p className="mt-1 text-xl font-semibold">{inventory.lowStockCount}</p>
          </article>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Out-of-Stock Products</h3>
          <ul className="space-y-2 text-sm">
            {inventory.outOfStockItems.length === 0 ? (
              <li className="text-muted-foreground">No out-of-stock active products.</li>
            ) : (
              inventory.outOfStockItems.map((item) => (
                <li key={item.productId} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                  {item.title}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Low-Stock Products</h3>
          <ul className="space-y-2 text-sm">
            {inventory.lowStockItems.length === 0 ? (
              <li className="text-muted-foreground">No low-stock active products.</li>
            ) : (
              inventory.lowStockItems.map((item) => (
                <li key={item.productId} className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
                  <span>{item.title}</span>
                  <span className="text-xs text-muted-foreground">{item.qty} left</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </SectionCard>
  );
}
