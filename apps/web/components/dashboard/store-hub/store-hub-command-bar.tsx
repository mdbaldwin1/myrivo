import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { StoreHubData } from "@/lib/dashboard/store-hub/store-hub-types";

type StoreHubCommandBarProps = {
  filters: StoreHubData["filters"];
};

export function StoreHubCommandBar({ filters }: StoreHubCommandBarProps) {
  const rangeOptions: Array<StoreHubData["filters"]["range"]> = ["today", "7d", "30d"];

  function hrefFor(range: StoreHubData["filters"]["range"], compare: boolean) {
    const query = new URLSearchParams();
    query.set("range", range);
    if (compare) {
      query.set("compare", "1");
    }
    return `/dashboard/stores?${query.toString()}`;
  }

  return (
    <section aria-label="Store hub controls" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {rangeOptions.map((range) => (
          <Link
            key={range}
            href={hrefFor(range, filters.compare)}
            className={`rounded-full border px-2 py-0.5 ${filters.range === range ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
          >
            {range}
          </Link>
        ))}
        <Link
          href={hrefFor(filters.range, !filters.compare)}
          className={`rounded-full border px-2 py-0.5 ${filters.compare ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
        >
          Compare
        </Link>
        <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">Updated: {new Date(filters.generatedAt).toLocaleString()}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" asChild>
          <Link href="/onboarding">Create store</Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/dashboard">Customer dashboard</Link>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href={hrefFor(filters.range, filters.compare)}>Refresh</Link>
        </Button>
      </div>
    </section>
  );
}
