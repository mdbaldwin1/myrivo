import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

function formatCompactCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1
  }).format(cents / 100);
}

function renderTrendTooltip(input: unknown, labelPrefix: string) {
  const { active, label, payload } = (input ?? {}) as {
    active?: boolean;
    label?: string | number;
    payload?: ReadonlyArray<{ name?: string | number; value?: unknown; color?: string }>;
  };

  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-md border border-border/70 bg-background px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-foreground">{labelPrefix} {label}</p>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <div key={String(entry.name)} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-medium text-foreground">
              {entry.name === "Revenue" ? formatCurrency(Number(entry.value ?? 0)) : String(entry.value ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StorefrontAnalyticsTrendPanel({ summary }: StorefrontAnalyticsTrendPanelProps) {
  const daily = summary.daily.map((point) => ({
    label: formatShortDate(point.date),
    sessions: point.sessions,
    pageViews: point.pageViews,
    revenueCents: point.revenueCents,
    paidOrders: point.paidOrders
  }));

  return (
    <SectionCard title="Traffic and Revenue Trend" description="Sessions and revenue are shown separately so each signal stays easy to read.">
      {daily.length === 0 ? (
        <p className="text-sm text-muted-foreground">No daily traffic yet for this range.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <article className="rounded-md border border-border/70 bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sessions</p>
                  <p className="mt-1 text-sm text-muted-foreground">Daily shopper traffic across the selected range.</p>
                </div>
                <p className="text-xs text-muted-foreground">{summary.current.sessions} total</p>
              </div>
              <div className="mt-4 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip content={(props) => renderTrendTooltip(props, "")} />
                    <Line
                      type="monotone"
                      dataKey="sessions"
                      name="Sessions"
                      stroke="hsl(var(--foreground))"
                      strokeWidth={2.5}
                      dot={{ r: 3, strokeWidth: 0, fill: "hsl(var(--foreground))" }}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="pageViews"
                      name="Page views"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="rounded-md border border-border/70 bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Revenue</p>
                  <p className="mt-1 text-sm text-muted-foreground">Daily paid-order revenue for the same period.</p>
                </div>
                <p className="text-xs text-muted-foreground">{formatCurrency(summary.current.revenueCents)} total</p>
              </div>
              <div className="mt-4 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
                      tickFormatter={(value: number) => formatCompactCurrency(value)}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip content={(props) => renderTrendTooltip(props, "")} />
                    <Bar dataKey="revenueCents" name="Revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
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
                {summary.daily.map((point) => (
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
