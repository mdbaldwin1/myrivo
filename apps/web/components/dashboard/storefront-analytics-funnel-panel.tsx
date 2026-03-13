"use client";

import React from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SectionCard } from "@/components/ui/section-card";
import type { StorefrontAnalyticsSummary } from "@/lib/analytics/query";

type StorefrontAnalyticsFunnelPanelProps = {
  summary: StorefrontAnalyticsSummary;
};

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function renderFunnelTooltip(input: unknown) {
  const { active, payload, label } = (input ?? {}) as {
    active?: boolean;
    payload?: ReadonlyArray<{ value?: unknown; payload?: { helper: string; rate: number } }>;
    label?: string | number;
  };

  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0]?.payload;

  return (
    <div className="rounded-md border border-border/70 bg-background px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 text-muted-foreground">{entry?.helper}</p>
      <p className="mt-2 text-foreground">
        {Number(payload[0]?.value ?? 0)} shoppers · {formatPercent(entry?.rate ?? 0)}
      </p>
    </div>
  );
}

export function StorefrontAnalyticsFunnelPanel({ summary }: StorefrontAnalyticsFunnelPanelProps) {
  const steps = [
    {
      id: "sessions",
      label: "Sessions",
      value: summary.current.sessions,
      rate: 1,
      helper: "Shopper visits in the selected window",
      fill: "hsl(var(--primary))"
    },
    {
      id: "product-views",
      label: "Product views",
      value: summary.current.productViews,
      rate: summary.current.sessions > 0 ? summary.current.productViews / summary.current.sessions : 0,
      helper: "Product detail traffic generated from storefront browsing",
      fill: "hsl(var(--primary) / 0.9)"
    },
    {
      id: "add-to-cart",
      label: "Added to cart",
      value: summary.current.addToCartSessions,
      rate: summary.current.productViews > 0 ? summary.current.addToCartSessions / summary.current.productViews : 0,
      helper: "Sessions that advanced from product interest into cart intent",
      fill: "hsl(var(--primary) / 0.82)"
    },
    {
      id: "checkout",
      label: "Started checkout",
      value: summary.current.checkoutStartedSessions,
      rate: summary.current.addToCartSessions > 0 ? summary.current.checkoutStartedSessions / summary.current.addToCartSessions : 0,
      helper: "Sessions that moved from cart into checkout",
      fill: "rgb(14 165 233)"
    },
    {
      id: "paid",
      label: "Paid orders",
      value: summary.current.paidOrders,
      rate: summary.current.checkoutStartedSessions > 0 ? summary.current.paidOrders / summary.current.checkoutStartedSessions : 0,
      helper: "Orders completed and attributed to analytics sessions",
      fill: "rgb(16 185 129)"
    }
  ];

  return (
    <SectionCard title="Shopper Funnel" description="See where interest turns into intent and where customers drop before purchasing.">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 rounded-md border border-border/70 bg-card p-4">
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              {steps.map((step) => (
                <div key={`${step.id}-summary`} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{step.label}</p>
                  <p className="mt-1 text-lg font-semibold">{step.value}</p>
                  <p className="text-xs text-muted-foreground">
                    {step.id === "sessions" ? "Baseline session volume" : `${formatPercent(step.rate)} from previous step`}
                  </p>
                </div>
              ))}
            </div>

            <div className="h-[22rem] min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={352}>
                <BarChart data={steps} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke="rgba(148, 163, 184, 0.16)" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    width={94}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} content={(props) => renderFunnelTooltip(props)} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {steps.map((step) => (
                      <Cell key={step.id} fill={step.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Key conversion</p>
            <p className="mt-1 text-2xl font-semibold">{formatPercent(summary.current.checkoutConversionRate)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Checkout completion from shoppers who started checkout.</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Add-to-cart efficiency</p>
            <p className="mt-1 text-2xl font-semibold">{formatPercent(summary.current.addToCartRate)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Product detail views that turned into cart intent.</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Attributed order sessions</p>
            <p className="mt-1 text-2xl font-semibold">{summary.current.paidOrderSessions}</p>
            <p className="mt-1 text-sm text-muted-foreground">Sessions with completed paid orders in the selected range.</p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
