"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppAlert } from "@/components/ui/app-alert";
import { SectionCard } from "@/components/ui/section-card";
import type { StoreDashboardData } from "@/lib/dashboard/store-dashboard/store-dashboard-types";

type PerformanceOverviewPanelProps = {
  filters: StoreDashboardData["filters"];
  performance: StoreDashboardData["performance"];
  errorMessage?: string;
  retryHref: string;
};

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDelta(value: number | "new" | null | undefined) {
  if (value === null || value === undefined) {
    return "n/a";
  }
  if (value === "new") {
    return "New";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function buildYearOptions(selectedYear: number) {
  const currentYear = new Date().getUTCFullYear();
  const latestYear = Math.min(selectedYear, currentYear);
  const earliestYear = Math.max(2000, latestYear - 4);
  const years: number[] = [];

  for (let year = latestYear; year >= earliestYear; year -= 1) {
    years.push(year);
  }

  return years;
}

export function PerformanceOverviewPanel({
  filters,
  performance,
  errorMessage,
  retryHref
}: PerformanceOverviewPanelProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const chartData = performance.series.map((point) => ({
    ...point,
    grossRevenueDollars: point.grossRevenueCents / 100
  }));

  const yearOptions = useMemo(() => buildYearOptions(filters.performanceYear), [filters.performanceYear]);
  const chartTitle = performance.seriesGranularity === "month" ? "Monthly Revenue" : "Daily Revenue";
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    const node = chartContainerRef.current;
    if (!node) {
      return;
    }

    const updateChartReady = () => {
      const nextReady = node.clientWidth > 0 && node.clientHeight > 0;
      setChartReady((current) => (current === nextReady ? current : nextReady));
    };

    updateChartReady();

    const observer = new ResizeObserver(() => {
      updateChartReady();
    });

    observer.observe(node);
    window.addEventListener("resize", updateChartReady);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateChartReady);
    };
  }, []);

  function pushFilters(next: { view?: "month" | "year"; month?: string; year?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next.view ?? filters.performanceView);
    params.set("month", next.month ?? filters.performanceMonth);
    params.set("year", next.year ?? String(filters.performanceYear));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <SectionCard
      title="Performance Overview"
      description={`Revenue trends and top products for ${performance.periodLabel}.`}
      action={
        <div className="flex flex-wrap items-end justify-end gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => pushFilters({ view: "month" })}
              className={`rounded-full border px-3 py-1 text-sm ${filters.performanceView === "month" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => pushFilters({ view: "year" })}
              className={`rounded-full border px-3 py-1 text-sm ${filters.performanceView === "year" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
            >
              Year
            </button>
          </div>

          {filters.performanceView === "month" ? (
            <label className="space-y-1 text-sm">
              <span className="block text-xs uppercase tracking-wide text-muted-foreground">Month</span>
              <input
                type="month"
                value={filters.performanceMonth}
                onChange={(event) => pushFilters({ view: "month", month: event.target.value })}
                max={currentMonth}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
          ) : (
            <label className="space-y-1 text-sm">
              <span className="block text-xs uppercase tracking-wide text-muted-foreground">Year</span>
              <select
                value={String(filters.performanceYear)}
                onChange={(event) => pushFilters({ view: "year", year: event.target.value })}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
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

        <div className="grid gap-2 sm:grid-cols-3">
          <article className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Revenue</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(performance.grossRevenueCents)}</p>
          </article>
          <article className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid Orders</p>
            <p className="mt-1 text-xl font-semibold">{performance.paidOrderCount}</p>
          </article>
          <article className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Average Order</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(performance.avgOrderValueCents)}</p>
          </article>
        </div>

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
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{chartTitle}</h3>
          <div className="min-w-0">
            {chartData.every((point) => point.grossRevenueCents === 0) ? (
              <p className="text-sm text-muted-foreground">No paid orders in this period.</p>
            ) : (
              <div ref={chartContainerRef} className="h-64 w-full min-w-0 min-h-[16rem] rounded-md border border-border bg-muted/10 p-3">
                {chartReady ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} className="fill-muted-foreground" />
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
                        labelFormatter={(label) => `${performance.seriesGranularity === "month" ? "Month" : "Day"}: ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="grossRevenueDollars"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        dot={{ r: 3, strokeWidth: 0, fill: "hsl(var(--primary))" }}
                        activeDot={{ r: 5, strokeWidth: 0, fill: "hsl(var(--primary))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                    Preparing chart...
                  </div>
                )}
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
