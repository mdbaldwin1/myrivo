import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StorefrontAnalyticsTab } from "@/components/dashboard/storefront-analytics-tab-nav";
import type { StorefrontAnalyticsRange } from "@/lib/analytics/query";
import { cn } from "@/lib/utils";

type StorefrontAnalyticsFilterBarProps = {
  storeSlug: string;
  range: StorefrontAnalyticsRange;
  compare: boolean;
  tab?: StorefrontAnalyticsTab;
};

const RANGE_OPTIONS: Array<{ id: StorefrontAnalyticsRange; label: string }> = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" }
];

function buildAnalyticsHref(storeSlug: string, range: StorefrontAnalyticsRange, compare: boolean, tab?: StorefrontAnalyticsTab) {
  const searchParams = new URLSearchParams();
  if (range !== "30d") {
    searchParams.set("range", range);
  }
  if (!compare) {
    searchParams.set("compare", "0");
  }
  if (tab && tab !== "overview") {
    searchParams.set("tab", tab);
  }

  const query = searchParams.toString();
  return query ? `/dashboard/stores/${storeSlug}/analytics?${query}` : `/dashboard/stores/${storeSlug}/analytics`;
}

export function StorefrontAnalyticsFilterBar({ storeSlug, range, compare, tab }: StorefrontAnalyticsFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Badge variant="outline" className="h-9 rounded-md border-border/70 px-3 text-[11px] uppercase tracking-[0.14em]">
        Storefront analytics
      </Badge>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-card p-1 shadow-sm">
        {RANGE_OPTIONS.map((option) => {
          const isActive = option.id === range;
          return (
            <Button
              key={option.id}
              asChild
              size="sm"
              variant={isActive ? "default" : "ghost"}
              className={cn("min-w-20", !isActive && "text-muted-foreground")}
            >
              <Link href={buildAnalyticsHref(storeSlug, option.id, compare, tab)}>{option.label}</Link>
            </Button>
          );
        })}
      </div>
      <Button asChild size="sm" variant={compare ? "default" : "outline"}>
        <Link href={buildAnalyticsHref(storeSlug, range, !compare, tab)}>{compare ? "Compare enabled" : "Compare off"}</Link>
      </Button>
    </div>
  );
}
