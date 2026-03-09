import { StoreHubCommandBar } from "@/components/dashboard/store-hub/store-hub-command-bar";
import { StoreHubActivityPanel } from "@/components/dashboard/store-hub/modules/store-hub-activity-panel";
import { StoreHubApprovalQueuePanel } from "@/components/dashboard/store-hub/modules/store-hub-approval-queue-panel";
import { StoreHubGrowthPanel } from "@/components/dashboard/store-hub/modules/store-hub-growth-panel";
import { StoreHubOperationsPanel } from "@/components/dashboard/store-hub/modules/store-hub-operations-panel";
import { StoreHubPortfolioPanel } from "@/components/dashboard/store-hub/modules/store-hub-portfolio-panel";
import { StoreHubPriorityQueuePanel } from "@/components/dashboard/store-hub/modules/store-hub-priority-queue-panel";
import { StoreHubSummaryCards } from "@/components/dashboard/store-hub/modules/store-hub-summary-cards";
import type { StoreHubData } from "@/lib/dashboard/store-hub/store-hub-types";

type StoreHubShellProps = {
  data: StoreHubData;
  logoByStoreId: Map<string, string | null>;
};

export function StoreHubShell({ data, logoByStoreId }: StoreHubShellProps) {
  const canApprove = data.role === "admin";

  return (
    <section className="space-y-4">
      <StoreHubCommandBar filters={data.filters} />
      <StoreHubSummaryCards summary={data.summary} />
      <StoreHubPriorityQueuePanel items={data.priorityQueue} />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <StoreHubOperationsPanel operations={data.operations} />
        </div>
        <div className="lg:col-span-4">
          <StoreHubApprovalQueuePanel initialItems={data.approvalQueue} canApprove={canApprove} />
        </div>
      </div>
      <StoreHubPortfolioPanel stores={data.stores} logoByStoreId={logoByStoreId} />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <StoreHubGrowthPanel growth={data.growth} />
        </div>
        <div className="lg:col-span-6">
          <StoreHubActivityPanel activity={data.activity} />
        </div>
      </div>
    </section>
  );
}
