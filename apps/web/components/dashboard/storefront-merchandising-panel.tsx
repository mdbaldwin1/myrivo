import React from "react";
import Link from "next/link";
import { ArrowUpRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { buildAnalyticsExportHref } from "@/lib/analytics/export";
import type { StorefrontMerchandisingSummary } from "@/lib/analytics/merchandising";
import type { StorefrontAnalyticsRange } from "@/lib/analytics/query";
import { getStorefrontStudioSurfaceForHref, type StorefrontStudioSurfaceId } from "@/lib/store-editor/storefront-studio";

type StorefrontMerchandisingPanelProps = {
  storeSlug: string;
  range: StorefrontAnalyticsRange;
  summary: StorefrontMerchandisingSummary;
};

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function getStudioHrefForSurface(storeSlug: string, surfaceId: StorefrontStudioSurfaceId) {
  if (surfaceId === "home") {
    return `/dashboard/stores/${storeSlug}/storefront-studio`;
  }
  return `/dashboard/stores/${storeSlug}/storefront-studio?surface=${surfaceId}`;
}

function getPageAction(storeSlug: string, path: string) {
  const surface = getStorefrontStudioSurfaceForHref(path, storeSlug);
  if (surface) {
    return {
      href: getStudioHrefForSurface(storeSlug, surface),
      label: "Open in Studio"
    };
  }

  return {
    href: path.startsWith("/") ? path : `/s/${storeSlug}`,
    label: "Open page"
  };
}

export function StorefrontMerchandisingPanel({ storeSlug, range, summary }: StorefrontMerchandisingPanelProps) {
  return (
    <SectionCard title="Merchandising" description="What shoppers view, search, and convert on across the storefront.">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-border/70 bg-muted/25 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Most visited page</p>
            <p className="mt-2 text-lg font-semibold">{summary.topPages[0]?.path ?? "No page data"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{summary.topPages[0] ? `${summary.topPages[0].views} page views in the selected range` : "We have not recorded storefront browsing yet."}</p>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/25 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Top product</p>
            <p className="mt-2 text-lg font-semibold">{summary.topProducts[0]?.title ?? "No product data"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.topProducts[0]
                ? `${summary.topProducts[0].views} views · ${summary.topProducts[0].orders} ordered`
                : "Once product pages receive traffic, this will highlight the strongest performer."}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/25 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Top search</p>
            <p className="mt-2 text-lg font-semibold">{summary.topSearches[0]?.query ?? "No search data"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.topSearches[0]
                ? `${summary.topSearches[0].searches} searches · ${summary.topSearches[0].averageResults.toFixed(1)} average results`
                : "Search analytics will surface once shoppers start using the catalog search."}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/25 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Newsletter signup rate</p>
            <p className="mt-2 text-lg font-semibold">{formatPercent(summary.newsletter.signupRate)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{summary.newsletter.signups} new subscribers attributed to storefront traffic.</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Top Pages</h3>
            <Button asChild size="sm" variant="outline">
              <Link href={buildAnalyticsExportHref(storeSlug, range, "top-pages")}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Link>
            </Button>
          </div>
          <ul className="space-y-1 text-sm">
            {summary.topPages.length === 0 ? (
              <li className="text-muted-foreground">No page-view data yet.</li>
            ) : (
              summary.topPages.map((page) => (
                <li key={page.path} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/25 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{page.path}</p>
                    <p className="text-xs text-muted-foreground">{page.views} views</p>
                  </div>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={getPageAction(storeSlug, page.path).href}>
                      {getPageAction(storeSlug, page.path).label}
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Top Products</h3>
            <Button asChild size="sm" variant="outline">
              <Link href={buildAnalyticsExportHref(storeSlug, range, "top-products")}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Link>
            </Button>
          </div>
          <ul className="space-y-1 text-sm">
            {summary.topProducts.length === 0 ? (
              <li className="text-muted-foreground">No product traffic yet.</li>
            ) : (
              summary.topProducts.map((product) => (
                <li key={product.productId} className="rounded-md border border-border bg-muted/25 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{product.title}</span>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/dashboard/stores/${storeSlug}/catalog?productId=${product.productId}`}>
                        Open in catalog
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {product.views} views · {product.addToCart} add to cart · {product.orders} ordered · {formatCurrency(product.revenueCents)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Low Conversion Products</h3>
            <Button asChild size="sm" variant="outline">
              <Link href={buildAnalyticsExportHref(storeSlug, range, "low-conversion-products")}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Link>
            </Button>
          </div>
          <ul className="space-y-1 text-sm">
            {summary.lowConversionProducts.length === 0 ? (
              <li className="text-muted-foreground">No low-conversion watchlist yet.</li>
            ) : (
              summary.lowConversionProducts.map((product) => (
                <li key={product.productId} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/25 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{product.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.views} views · {product.orders} ordered · {formatPercent(product.conversionRate)}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/dashboard/stores/${storeSlug}/catalog?productId=${product.productId}`}>
                      Inspect
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Search and Newsletter</h3>
            <Button asChild size="sm" variant="outline">
              <Link href={buildAnalyticsExportHref(storeSlug, range, "top-searches")}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Link>
            </Button>
          </div>
          <div className="rounded-md border border-border bg-muted/25 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Newsletter Signup Rate</p>
            <p className="mt-1 text-lg font-semibold">
              {formatPercent(summary.newsletter.signupRate)} ({summary.newsletter.signups} signups)
            </p>
            <div className="mt-3">
              <Button asChild size="sm" variant="ghost">
                <Link href={`/dashboard/stores/${storeSlug}/storefront-studio?surface=emails`}>
                  Review signup copy
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <ul className="space-y-1 text-sm">
            {summary.topSearches.length === 0 ? (
              <li className="text-muted-foreground">No search data yet.</li>
            ) : (
              summary.topSearches.map((search) => (
                <li key={search.query} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/25 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{search.query}</p>
                    <p className="text-xs text-muted-foreground">
                      {search.searches} searches · {search.averageResults.toFixed(1)} avg results
                    </p>
                  </div>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/dashboard/stores/${storeSlug}/catalog`}>
                      Tune catalog
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
      </div>
    </SectionCard>
  );
}
