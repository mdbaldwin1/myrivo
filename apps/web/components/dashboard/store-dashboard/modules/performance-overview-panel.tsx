"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  const dailyRevenueChartData = performance.dailySeries.map((point) => ({
    ...point,
    shortDate: point.date.slice(5),
    grossRevenueDollars: point.grossRevenueCents / 100
  }));

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
          <div className="min-w-0">
            {dailyRevenueChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No paid orders in this period.</p>
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
                      formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, "Revenue"]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Bar dataKey="grossRevenueDollars" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
