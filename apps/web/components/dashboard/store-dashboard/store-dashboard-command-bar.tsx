import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { StoreDashboardData } from "@/lib/dashboard/store-dashboard/store-dashboard-types";

type StoreDashboardCommandBarProps = {
  storeSlug: string;
  filters: StoreDashboardData["filters"];
};

export function StoreDashboardCommandBar({ storeSlug, filters }: StoreDashboardCommandBarProps) {
  const compareEnabled = filters.compare;
  const rangeOptions: Array<StoreDashboardData["filters"]["range"]> = ["today", "7d", "30d"];

  function hrefFor(range: StoreDashboardData["filters"]["range"], compare: boolean) {
    const query = new URLSearchParams();
    query.set("range", range);
    if (compare) {
      query.set("compare", "1");
    }
    return `/dashboard/stores/${storeSlug}?${query.toString()}`;
  }

  return (
    <section aria-label="Dashboard controls" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {rangeOptions.map((range) => (
          <Link
            key={range}
            href={hrefFor(range, compareEnabled)}
            className={`rounded-full border px-2 py-0.5 ${filters.range === range ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
          >
            {range}
          </Link>
        ))}
        <Link
          href={hrefFor(filters.range, !compareEnabled)}
          className={`rounded-full border px-2 py-0.5 ${compareEnabled ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
        >
          Compare
        </Link>
        <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
          Updated: {new Date(filters.generatedAt).toLocaleString()}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" asChild>
          <Link href={`/dashboard/stores/${storeSlug}/catalog`}>Create product</Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/dashboard/stores/${storeSlug}/promotions`}>Add promo</Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/dashboard/stores/${storeSlug}/orders/pick-list`} target="_blank" rel="noreferrer">
            Pick list
          </Link>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/s/${storeSlug}`} target="_blank" rel="noreferrer">
            Open storefront
          </Link>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href={hrefFor(filters.range, compareEnabled)}>Refresh</Link>
        </Button>
      </div>
    </section>
  );
}
