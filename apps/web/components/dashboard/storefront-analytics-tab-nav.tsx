import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StorefrontAnalyticsRange } from "@/lib/analytics/query";

export type StorefrontAnalyticsTab = "overview" | "acquisition";

type StorefrontAnalyticsTabNavProps = {
  storeSlug: string;
  range: StorefrontAnalyticsRange;
  compare: boolean;
  activeTab: StorefrontAnalyticsTab;
};

function buildAnalyticsTabHref(
  storeSlug: string,
  range: StorefrontAnalyticsRange,
  compare: boolean,
  tab: StorefrontAnalyticsTab
) {
  const searchParams = new URLSearchParams();
  if (range !== "30d") {
    searchParams.set("range", range);
  }
  if (!compare) {
    searchParams.set("compare", "0");
  }
  if (tab !== "overview") {
    searchParams.set("tab", tab);
  }

  const query = searchParams.toString();
  return query ? `/dashboard/stores/${storeSlug}/analytics?${query}` : `/dashboard/stores/${storeSlug}/analytics`;
}

const TAB_OPTIONS: Array<{ id: StorefrontAnalyticsTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "acquisition", label: "Acquisition" }
];

export function StorefrontAnalyticsTabNav({ storeSlug, range, compare, activeTab }: StorefrontAnalyticsTabNavProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-card p-1 shadow-sm">
      {TAB_OPTIONS.map((option) => {
        const isActive = option.id === activeTab;
        return (
          <Button
            key={option.id}
            asChild
            size="sm"
            variant={isActive ? "default" : "ghost"}
            className={cn("min-w-24", !isActive && "text-muted-foreground")}
          >
            <Link href={buildAnalyticsTabHref(storeSlug, range, compare, option.id)}>{option.label}</Link>
          </Button>
        );
      })}
    </div>
  );
}
