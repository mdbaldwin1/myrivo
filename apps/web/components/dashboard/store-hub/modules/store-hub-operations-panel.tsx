import { DataStat } from "@/components/ui/data-stat";
import { SectionCard } from "@/components/ui/section-card";
import type { StoreHubData } from "@/lib/dashboard/store-hub/store-hub-types";

type StoreHubOperationsPanelProps = {
  operations: StoreHubData["operations"];
};

export function StoreHubOperationsPanel({ operations }: StoreHubOperationsPanelProps) {
  return (
    <SectionCard title="Operations" description="Cross-store fulfillment and exception workload.">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <DataStat label="Pending Fulfillment" value={String(operations.pendingFulfillment)} className="bg-card" />
        <DataStat label="Packing" value={String(operations.packing)} className="bg-card" />
        <DataStat label="Overdue" value={String(operations.overdueFulfillment)} className="bg-card" />
        <DataStat label="Shipping Exceptions" value={String(operations.shippingExceptions)} className="bg-card" />
        <DataStat label="Pickup Due (4h)" value={String(operations.pickupDueSoon)} className="bg-card" />
      </div>
    </SectionCard>
  );
}
