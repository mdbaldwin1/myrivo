import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { PerformanceOverviewPanel } from "@/components/dashboard/store-dashboard/modules/performance-overview-panel";
import { PriorityAlertsPanel } from "@/components/dashboard/store-dashboard/modules/priority-alerts-panel";
import { StoreHealthPanel } from "@/components/dashboard/store-dashboard/modules/store-health-panel";
import { TodayOperationsPanel } from "@/components/dashboard/store-dashboard/modules/today-operations-panel";
import type { StoreDashboardData } from "@/lib/dashboard/store-dashboard/store-dashboard-types";

type StoreDashboardShellProps = { data: StoreDashboardData };

export function StoreDashboardShell({ data }: StoreDashboardShellProps) {
  const retryParams = new URLSearchParams();
  retryParams.set("view", data.filters.performanceView);
  retryParams.set("month", data.filters.performanceMonth);
  retryParams.set("year", String(data.filters.performanceYear));
  const retryHref = `/dashboard/stores/${data.store.slug}?${retryParams.toString()}`;

  return (
    <DashboardPageScaffold
      title={`${data.store.name} Overview`}
      description="A simpler view of store operations, alerts, and performance."
      className="p-3"
    >
      <section aria-label="Alerts and fulfillment" className="grid gap-4 lg:grid-cols-12">
        <div className={`min-w-0 ${data.health.score < 100 ? "lg:col-span-5" : "lg:col-span-6"}`}>
          <PriorityAlertsPanel alerts={data.alerts} />
        </div>
        <div className={`min-w-0 ${data.health.score < 100 ? "lg:col-span-4" : "lg:col-span-6"}`}>
          <TodayOperationsPanel operations={data.operations} />
        </div>
        {data.health.score < 100 ? (
          <div className="min-w-0 lg:col-span-3">
            <StoreHealthPanel health={data.health} errorMessage={data.moduleErrors?.health} retryHref={retryHref} />
          </div>
        ) : null}
      </section>

      <PerformanceOverviewPanel
        filters={data.filters}
        performance={data.performance}
        errorMessage={data.moduleErrors?.performance}
        retryHref={retryHref}
      />
    </DashboardPageScaffold>
  );
}
