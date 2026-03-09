import Link from "next/link";
import { AppAlert } from "@/components/ui/app-alert";
import { SectionCard } from "@/components/ui/section-card";
import type { StoreDashboardData } from "@/lib/dashboard/store-dashboard/store-dashboard-types";

type PerformanceOverviewPanelProps = {
  performance: StoreDashboardData["performance"];
  errorMessage?: string;
  retryHref: string;
};

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDelta(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "n/a";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function PerformanceOverviewPanel({ performance, errorMessage, retryHref }: PerformanceOverviewPanelProps) {
  const maxDailyRevenue = Math.max(1, ...performance.dailySeries.map((point) => point.grossRevenueCents));

  return (
    <SectionCard title="Performance Overview" description="Revenue trends, period deltas, and top-selling products.">
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
        <div className="grid gap-2 sm:grid-cols-3">
          <article className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Revenue Delta</p>
            <p className="mt-1 text-xl font-semibold">{formatDelta(performance.periodDelta?.grossRevenuePct)}</p>
          </article>
          <article className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Order Delta</p>
            <p className="mt-1 text-xl font-semibold">{formatDelta(performance.periodDelta?.orderCountPct)}</p>
          </article>
          <article className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">AOV Delta</p>
            <p className="mt-1 text-xl font-semibold">{formatDelta(performance.periodDelta?.avgOrderValuePct)}</p>
          </article>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Daily Revenue</h3>
          <div className="grid gap-1">
            {performance.dailySeries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No paid orders in this period.</p>
            ) : (
              performance.dailySeries.map((point) => (
                <div key={point.date} className="grid grid-cols-[80px_1fr_120px] items-center gap-2 text-xs">
                  <span>{point.date.slice(5)}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${(point.grossRevenueCents / maxDailyRevenue) * 100}%` }} />
                  </div>
                  <span>{formatCurrency(point.grossRevenueCents)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Top Products</h3>
          <ul className="space-y-2 text-sm">
            {performance.topProducts.length === 0 ? (
              <li className="text-muted-foreground">No top products yet.</li>
            ) : (
              performance.topProducts.map((product) => (
                <li key={product.productId} className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
                  <span className="min-w-0 truncate">{product.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(product.revenueCents)} ({product.units} units)
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </SectionCard>
  );
}
