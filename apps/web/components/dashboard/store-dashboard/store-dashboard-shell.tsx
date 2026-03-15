import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { ActivityTimelinePanel } from "@/components/dashboard/store-dashboard/modules/activity-timeline-panel";
import { GrowthSnapshotPanel } from "@/components/dashboard/store-dashboard/modules/growth-snapshot-panel";
import { InventoryRiskPanel } from "@/components/dashboard/store-dashboard/modules/inventory-risk-panel";
import { PerformanceOverviewPanel } from "@/components/dashboard/store-dashboard/modules/performance-overview-panel";
import { PriorityAlertsPanel } from "@/components/dashboard/store-dashboard/modules/priority-alerts-panel";
import { StoreHealthPanel } from "@/components/dashboard/store-dashboard/modules/store-health-panel";
import { TodayOperationsPanel } from "@/components/dashboard/store-dashboard/modules/today-operations-panel";
import { StoreDashboardCommandBar } from "@/components/dashboard/store-dashboard/store-dashboard-command-bar";
import { DataStat } from "@/components/ui/data-stat";
import type { StoreDashboardData } from "@/lib/dashboard/store-dashboard/store-dashboard-types";

type StoreDashboardShellProps = {
  data: StoreDashboardData;
};

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function StoreDashboardShell({ data }: StoreDashboardShellProps) {
  const retryParams = new URLSearchParams();
  retryParams.set("range", data.filters.range);
  if (data.filters.compare) {
    retryParams.set("compare", "1");
  }
  const retryHref = `/dashboard/stores/${data.store.slug}?${retryParams.toString()}`;

  return (
    <DashboardPageScaffold
      title={`${data.store.name} Control Tower`}
      description="Operational command center for urgent tasks, readiness, and performance."
      className="p-3"
    >
      <StoreDashboardCommandBar storeSlug={data.store.slug} filters={data.filters} />

      <PriorityAlertsPanel alerts={data.alerts} />

      <section aria-label="Top metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <DataStat label="Gross Revenue" value={formatCurrency(data.performance.grossRevenueCents)} className="bg-card" />
        <DataStat label="Net Payout" value={formatCurrency(data.performance.netPayoutCents)} className="bg-card" />
        <DataStat label="Paid Orders" value={String(data.performance.paidOrderCount)} className="bg-card" />
        <DataStat label="Average Order" value={formatCurrency(data.performance.avgOrderValueCents)} className="bg-card" />
        <DataStat label="Low Stock SKUs" value={String(data.inventory.lowStockCount)} className="bg-card" />
      </section>

      <section aria-label="Operations and health" className="grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <TodayOperationsPanel operations={data.operations} />
        </div>
        <div className="min-w-0 lg:col-span-4">
          <StoreHealthPanel health={data.health} errorMessage={data.moduleErrors?.health} retryHref={retryHref} />
        </div>
      </section>

      <section aria-label="Performance and inventory" className="grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <PerformanceOverviewPanel performance={data.performance} errorMessage={data.moduleErrors?.performance} retryHref={retryHref} />
        </div>
        <div className="min-w-0 lg:col-span-4">
          <InventoryRiskPanel
            inventory={data.inventory}
            storeSlug={data.store.slug}
            errorMessage={data.moduleErrors?.inventory}
            retryHref={retryHref}
          />
        </div>
      </section>

      <section aria-label="Growth and activity" className="grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-4">
          <GrowthSnapshotPanel growth={data.growth} storeSlug={data.store.slug} errorMessage={data.moduleErrors?.growth} retryHref={retryHref} />
        </div>
        <div className="min-w-0 lg:col-span-8">
          <ActivityTimelinePanel timeline={data.timeline} errorMessage={data.moduleErrors?.timeline} retryHref={retryHref} />
        </div>
      </section>
    </DashboardPageScaffold>
  );
}
