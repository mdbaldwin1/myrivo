import { DataStat } from "@/components/ui/data-stat";
import { SectionCard } from "@/components/ui/section-card";
import type { StorefrontAnalyticsSummary } from "@/lib/analytics/query";

type StorefrontAnalyticsPanelProps = {
  summary: StorefrontAnalyticsSummary;
};

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDelta(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) {
    return null;
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}% vs prior`;
}

type AnalyticsStatCardProps = {
  label: string;
  value: string;
  hint?: string | null;
};

function AnalyticsStatCard({ label, value, hint }: AnalyticsStatCardProps) {
  return (
    <div className="space-y-1">
      <DataStat label={label} value={value} className="bg-card" />
      {hint ? <p className="px-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StorefrontAnalyticsPanel({ summary }: StorefrontAnalyticsPanelProps) {
  return (
    <SectionCard title="Storefront Performance" description="The top-line shopper and revenue signals for the selected analytics window.">
      <div className="space-y-5">
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AnalyticsStatCard label="Sessions" value={String(summary.current.sessions)} hint={formatDelta(summary.deltas?.sessions)} />
          <AnalyticsStatCard label="Page Views" value={String(summary.current.pageViews)} hint={formatDelta(summary.deltas?.pageViews)} />
          <AnalyticsStatCard label="Product Views" value={String(summary.current.productViews)} hint={formatDelta(summary.deltas?.productViews)} />
          <AnalyticsStatCard label="Revenue" value={formatCurrency(summary.current.revenueCents)} hint={formatDelta(summary.deltas?.revenueCents)} />
          <AnalyticsStatCard
            label="Add-to-Cart Rate"
            value={formatPercent(summary.current.addToCartRate)}
            hint={formatDelta(summary.deltas?.addToCartRate)}
          />
          <AnalyticsStatCard
            label="Checkout Conversion"
            value={formatPercent(summary.current.checkoutConversionRate)}
            hint={formatDelta(summary.deltas?.checkoutConversionRate)}
          />
        </section>

        <section className="grid gap-3 lg:grid-cols-3">
          <article className="rounded-md border border-border/70 bg-muted/25 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cart intent</p>
            <p className="mt-2 text-3xl font-semibold">{summary.current.addToCartSessions}</p>
            <p className="mt-1 text-sm text-muted-foreground">Sessions that moved from browsing into a cart action.</p>
          </article>
          <article className="rounded-md border border-border/70 bg-muted/25 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Checkout starts</p>
            <p className="mt-2 text-3xl font-semibold">{summary.current.checkoutStartedSessions}</p>
            <p className="mt-1 text-sm text-muted-foreground">Sessions that entered checkout after building a cart.</p>
          </article>
          <article className="rounded-md border border-border/70 bg-muted/25 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Attributed paid orders</p>
            <p className="mt-2 text-3xl font-semibold">
              {summary.current.paidOrders} <span className="text-lg text-muted-foreground">/ {summary.current.paidOrderSessions} sessions</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Completed orders we can tie back to tracked storefront sessions.</p>
          </article>
        </section>
      </div>
    </SectionCard>
  );
}
