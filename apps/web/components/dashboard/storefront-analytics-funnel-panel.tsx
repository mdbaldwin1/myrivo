import React from "react";
import { SectionCard } from "@/components/ui/section-card";
import type { StorefrontAnalyticsSummary } from "@/lib/analytics/query";
import { cn } from "@/lib/utils";

type StorefrontAnalyticsFunnelPanelProps = {
  summary: StorefrontAnalyticsSummary;
};

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function StorefrontAnalyticsFunnelPanel({ summary }: StorefrontAnalyticsFunnelPanelProps) {
  const steps = [
    {
      id: "sessions",
      label: "Sessions",
      value: summary.current.sessions,
      rate: 1,
      helper: "Shopper visits in the selected window"
    },
    {
      id: "product-views",
      label: "Product views",
      value: summary.current.productViews,
      rate: summary.current.sessions > 0 ? summary.current.productViews / summary.current.sessions : 0,
      helper: "Product detail traffic generated from storefront browsing"
    },
    {
      id: "add-to-cart",
      label: "Added to cart",
      value: summary.current.addToCartSessions,
      rate: summary.current.productViews > 0 ? summary.current.addToCartSessions / summary.current.productViews : 0,
      helper: "Sessions that advanced from product interest into cart intent"
    },
    {
      id: "checkout",
      label: "Started checkout",
      value: summary.current.checkoutStartedSessions,
      rate: summary.current.addToCartSessions > 0 ? summary.current.checkoutStartedSessions / summary.current.addToCartSessions : 0,
      helper: "Sessions that moved from cart into checkout"
    },
    {
      id: "paid",
      label: "Paid orders",
      value: summary.current.paidOrders,
      rate: summary.current.checkoutStartedSessions > 0 ? summary.current.paidOrders / summary.current.checkoutStartedSessions : 0,
      helper: "Orders completed and attributed to analytics sessions"
    }
  ];

  return (
    <SectionCard title="Shopper Funnel" description="See where interest turns into intent and where customers drop before purchasing.">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={step.id} className="grid gap-3 rounded-md border border-border/70 bg-card p-4 md:grid-cols-[12rem_minmax(0,1fr)_5.5rem] md:items-center">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Step {index + 1}</p>
                <p className="mt-1 text-base font-semibold">{step.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.helper}</p>
              </div>
              <div className="space-y-2">
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      index === 0 ? "bg-primary/80" : index <= 2 ? "bg-primary" : "bg-emerald-500"
                    )}
                    style={{ width: `${Math.max(6, Math.min(step.rate * 100, 100))}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {index === 0 ? "Baseline session volume" : `${formatPercent(step.rate)} from previous step`}
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-2xl font-semibold">{step.value}</p>
                <p className="text-xs text-muted-foreground">{index === 0 ? "100.0%" : formatPercent(step.rate)}</p>
              </div>
            </div>
          ))}
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
