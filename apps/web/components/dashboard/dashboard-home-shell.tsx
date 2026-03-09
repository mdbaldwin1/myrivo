import Link from "next/link";
import { CustomerAccountDashboardPanels } from "@/components/customer/customer-account-dashboard-panels";
import { NotificationsFeed } from "@/components/dashboard/notifications-feed";
import { DataStat } from "@/components/ui/data-stat";
import { SectionCard } from "@/components/ui/section-card";
import type { DashboardHomeData } from "@/lib/dashboard/home/dashboard-home-types";

type DashboardHomeShellProps = {
  data: DashboardHomeData;
  storefrontLinksBySlug: Record<
    string,
    {
      storefrontHref: string;
      cartHref: string;
    }
  >;
  legacyPanelProps: {
    initialSavedStores: Array<{
      id: string;
      stores: { id: string; name: string; slug: string; status?: string } | { id: string; name: string; slug: string; status?: string }[] | null;
    }>;
    initialSavedItems: Array<{
      id: string;
      products: { id: string; title: string } | { id: string; title: string }[] | null;
      product_variants: { id: string; title: string | null } | { id: string; title: string | null }[] | null;
      stores: { id: string; name: string; slug: string; status?: string } | { id: string; name: string; slug: string; status?: string }[] | null;
    }>;
    carts: Array<{
      id: string;
      updated_at: string | null;
      stores: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
    }>;
    orders: Array<{
      id: string;
      total_cents: number;
      status: string;
      created_at: string;
      stores: { name: string; slug: string } | { name: string; slug: string }[] | null;
    }>;
  };
};

function severityClass(severity: DashboardHomeData["priorities"][number]["severity"]) {
  if (severity === "critical") {
    return "border-rose-300 bg-rose-50 text-rose-700";
  }
  if (severity === "high") {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }
  return "border-sky-300 bg-sky-50 text-sky-700";
}

export function DashboardHomeShell({ data, storefrontLinksBySlug, legacyPanelProps }: DashboardHomeShellProps) {
  return (
    <section className="space-y-4">
      <section aria-label="Home summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DataStat label="Unread Notifications" value={String(data.summary.unreadNotificationCount)} className="bg-card" />
        <DataStat label="Open Orders" value={String(data.summary.openOrdersCount)} className="bg-card" />
        <DataStat label="Active Carts" value={String(data.summary.activeCartCount)} className="bg-card" />
        <DataStat label="Stores You Manage" value={String(data.summary.managedStoreCount)} className="bg-card" />
      </section>

      <SectionCard title="Priority Queue" description="Highest-value next actions across your customer and workspace activity.">
        <ul className="space-y-2 text-sm">
          {data.priorities.map((item) => (
            <li key={item.id} className="rounded-md border border-border bg-muted/20 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{item.title}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase ${severityClass(item.severity)}`}>
                  {item.severity}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              <Link href={item.href} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                Open
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <SectionCard title="Continue Shopping" description="Your active carts with direct checkout continuation.">
            <ul className="space-y-2 text-sm">
              {data.carts.length === 0 ? <li className="text-muted-foreground">No active carts.</li> : null}
              {data.carts.map((cart) => (
                <li key={cart.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{cart.storeName}</p>
                    <p className="text-xs text-muted-foreground">
                      {cart.itemCount} item(s) · ${(cart.subtotalCents / 100).toFixed(2)} · updated {cart.updatedAt ? new Date(cart.updatedAt).toLocaleString() : "recently"}
                    </p>
                  </div>
                  <Link
                    href={storefrontLinksBySlug[cart.storeSlug]?.cartHref ?? `/cart?store=${encodeURIComponent(cart.storeSlug)}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Open cart
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
        <div className="lg:col-span-4">
          <SectionCard title="Workspace Pulse" description="Store and platform context based on your role.">
            <div className="space-y-3 text-sm">
              {data.workspacePulse ? (
                <>
                  <p>Managing {data.workspacePulse.managedStoreCount} store(s).</p>
                  <p>{data.workspacePulse.pendingFulfillmentCount} pending fulfillment order(s).</p>
                  <p>{data.workspacePulse.pendingReviewCount} store(s) pending review.</p>
                  <Link href="/dashboard/stores" className="text-xs font-medium text-primary hover:underline">
                    Open Store Hub
                  </Link>
                </>
              ) : (
                <p className="text-muted-foreground">No store workspace memberships.</p>
              )}

              {data.platformPulse ? (
                <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  <p className="font-medium">Platform</p>
                  <p className="text-xs text-muted-foreground">{data.platformPulse.pendingApprovalCount} store approval(s) pending.</p>
                  <Link href="/dashboard/admin" className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                    Open Admin Workspace
                  </Link>
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Inbox Preview" description="Latest notifications with quick actions.">
        <NotificationsFeed storeSlug={null} mode="compact" />
      </SectionCard>

      <CustomerAccountDashboardPanels
        initialSavedStores={legacyPanelProps.initialSavedStores}
        initialSavedItems={legacyPanelProps.initialSavedItems}
        carts={legacyPanelProps.carts}
        orders={legacyPanelProps.orders}
        storefrontLinksBySlug={storefrontLinksBySlug}
      />
    </section>
  );
}
