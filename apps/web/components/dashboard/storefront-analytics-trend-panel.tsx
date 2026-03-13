import React from "react";
import { SectionCard } from "@/components/ui/section-card";
import type { StorefrontAnalyticsSummary } from "@/lib/analytics/query";

type StorefrontAnalyticsTrendPanelProps = {
  summary: StorefrontAnalyticsSummary;
};

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function buildPolylinePoints(values: number[], width: number, height: number) {
  const max = Math.max(1, ...values);
  if (values.length === 1) {
    return `0,${height / 2} ${width},${height / 2}`;
  }

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - (value / max) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

export function StorefrontAnalyticsTrendPanel({ summary }: StorefrontAnalyticsTrendPanelProps) {
  const daily = summary.daily;
  const revenueValues = daily.map((point) => point.revenueCents);
  const sessionValues = daily.map((point) => point.sessions);
  const maxRevenue = Math.max(1, ...revenueValues);
  const sessionLine = buildPolylinePoints(sessionValues, 100, 48);

  return (
    <SectionCard title="Traffic and Revenue Trend" description="Daily trend lines for session volume with matched revenue bars.">
      {daily.length === 0 ? (
        <p className="text-sm text-muted-foreground">No daily traffic yet for this range.</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-border/70 bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Legend</p>
                <p className="mt-1 text-sm text-muted-foreground">Blue bars show revenue. The slate line shows session volume.</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  Revenue
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-0.5 w-5 bg-slate-500" />
                  Sessions
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(2.5rem,1fr))] items-end gap-2">
              {daily.map((point) => (
                <div key={point.date} className="space-y-2">
                  <div className="relative flex h-36 items-end justify-center rounded-md bg-muted/25 px-1 pt-3">
                    <svg viewBox="0 0 100 48" className="pointer-events-none absolute inset-x-0 top-2 h-12 w-full px-1" aria-hidden="true">
                      <polyline fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-500/80" points={sessionLine} />
                    </svg>
                    <div
                      className="w-full rounded-t-sm bg-primary/90"
                      style={{ height: `${Math.max(8, (point.revenueCents / maxRevenue) * 100)}%` }}
                    />
                  </div>
                  <div className="space-y-1 text-center">
                    <p className="text-[11px] font-medium text-foreground">{formatShortDate(point.date)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {point.sessions} sessions · {point.paidOrders} orders
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-border/70">
            <table className="min-w-full divide-y divide-border/70 text-sm">
              <thead className="bg-muted/30 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Sessions</th>
                  <th className="px-3 py-2">Page Views</th>
                  <th className="px-3 py-2">Product Views</th>
                  <th className="px-3 py-2">Started Checkout</th>
                  <th className="px-3 py-2">Paid Orders</th>
                  <th className="px-3 py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-card">
                {daily.map((point) => (
                  <tr key={point.date}>
                    <td className="px-3 py-2 font-medium">{formatShortDate(point.date)}</td>
                    <td className="px-3 py-2">{point.sessions}</td>
                    <td className="px-3 py-2">{point.pageViews}</td>
                    <td className="px-3 py-2">{point.productViews}</td>
                    <td className="px-3 py-2">{point.checkoutStarted}</td>
                    <td className="px-3 py-2">{point.paidOrders}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(point.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
