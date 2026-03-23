import Link from "next/link";
import Image from "next/image";
import { Store } from "lucide-react";
import { StoreWorkspaceLaunchLink } from "@/components/dashboard/store-workspace-launch-link";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import type { StoreHubData } from "@/lib/dashboard/store-hub/store-hub-types";
import { hasStoreRole } from "@/lib/auth/roles";

function getStatusPillClass(status: StoreHubData["stores"][number]["status"]) {
  if (status === "live") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "offline") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "pending_review") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (status === "changes_requested" || status === "rejected") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }
  if (status === "draft") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "suspended" || status === "removed") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

type StoreHubPortfolioPanelProps = {
  stores: StoreHubData["stores"];
  logoByStoreId: Map<string, string | null>;
};

export function StoreHubPortfolioPanel({ stores, logoByStoreId }: StoreHubPortfolioPanelProps) {
  return (
    <SectionCard title="Store Portfolio" description="All accessible stores ranked by attention needed.">
      {stores.length === 0 ? (
        <div className="space-y-3 rounded-md border border-dashed border-border/70 bg-muted/10 p-4">
          <p className="text-sm font-medium">No stores yet</p>
          <p className="text-sm text-muted-foreground">
            You do not have store workspace access yet. Create your first store to start building your storefront and seller workflow.
          </p>
          <Button size="sm" variant="brand" asChild>
            <Link href="/dashboard/stores/onboarding/new">Create store</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {stores.map((store) => (
            <li key={store.id} className="rounded-md border border-border/70 bg-card p-3 transition-colors hover:border-[hsl(var(--brand-secondary))]/35">
              {(() => {
                const canOpenWorkspace = hasStoreRole(store.role, "staff");
                const overviewHref = `/dashboard/stores/${store.slug}`;

                return (
                  <>
              <div className="flex items-start justify-between gap-3">
                {canOpenWorkspace ? (
                  <StoreWorkspaceLaunchLink href={overviewHref} storeSlug={store.slug} className="flex min-w-0 flex-1 items-start gap-3">
                    {logoByStoreId.get(store.id) ? (
                      <Image
                        src={logoByStoreId.get(store.id) ?? ""}
                        alt={`${store.name} logo`}
                        width={40}
                        height={40}
                        unoptimized
                        className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--brand-secondary))]/15 bg-[hsl(var(--brand-secondary-soft))]/55 text-xs font-semibold text-[hsl(var(--brand-secondary))]">
                        {store.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{store.name}</p>
                      <p className="text-xs text-muted-foreground">Role: {store.role}</p>
                    </div>
                  </StoreWorkspaceLaunchLink>
                ) : (
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {logoByStoreId.get(store.id) ? (
                      <Image
                        src={logoByStoreId.get(store.id) ?? ""}
                        alt={`${store.name} logo`}
                        width={40}
                        height={40}
                        unoptimized
                        className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--brand-secondary))]/15 bg-[hsl(var(--brand-secondary-soft))]/55 text-xs font-semibold text-[hsl(var(--brand-secondary))]">
                        {store.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{store.name}</p>
                      <p className="text-xs text-muted-foreground">Role: {store.role}</p>
                    </div>
                  </div>
                )}
                <p className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getStatusPillClass(store.status)}`}>
                  {store.status.replace("_", " ")}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-border/70 bg-muted/15 px-2 py-1.5">
                  <p className="text-muted-foreground">Health</p>
                  <p className="font-semibold">{store.healthScore}</p>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/15 px-2 py-1.5">
                  <p className="text-muted-foreground">Alerts</p>
                  <p className="font-semibold">{store.alertCount}</p>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/15 px-2 py-1.5">
                  <p className="text-muted-foreground">Pending</p>
                  <p className="font-semibold">{store.pendingFulfillment}</p>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/15 px-2 py-1.5">
                  <p className="text-muted-foreground">Revenue (7d)</p>
                  <p className="font-semibold">{formatCurrency(store.grossRevenueCents)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {canOpenWorkspace ? (
                  <>
                    <Button size="sm" variant="brand" asChild>
                      <StoreWorkspaceLaunchLink href={overviewHref} storeSlug={store.slug}>Open</StoreWorkspaceLaunchLink>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <StoreWorkspaceLaunchLink href={`/dashboard/stores/${store.slug}/orders`} storeSlug={store.slug}>Orders</StoreWorkspaceLaunchLink>
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Workspace access requires a staff role or higher.</p>
                )}
                <Button size="icon" className="ml-auto h-8 w-8" asChild>
                  <Link href={`/s/${store.slug}`} target="_blank" rel="noreferrer" aria-label={`View ${store.name} storefront`}>
                    <Store className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
                  </>
                );
              })()}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
