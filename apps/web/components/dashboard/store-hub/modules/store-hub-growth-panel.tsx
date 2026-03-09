import { DataStat } from "@/components/ui/data-stat";
import { SectionCard } from "@/components/ui/section-card";
import type { StoreHubData } from "@/lib/dashboard/store-hub/store-hub-types";

type StoreHubGrowthPanelProps = {
  growth: StoreHubData["growth"];
};

export function StoreHubGrowthPanel({ growth }: StoreHubGrowthPanelProps) {
  return (
    <SectionCard title="Growth" description="Subscriber, promo, and review moderation signals.">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <DataStat label="Subscribers" value={String(growth.subscribersTotal)} className="bg-card" />
        <DataStat label="Net New" value={String(growth.subscribersNetNew)} className="bg-card" />
        <DataStat label="Active Promos" value={String(growth.promotionsActive)} className="bg-card" />
        <DataStat label="Promo Redemptions" value={String(growth.promotionsRedeemed)} className="bg-card" />
        <DataStat label="Reviews Pending" value={String(growth.reviewsPending)} className="bg-card" />
      </div>
    </SectionCard>
  );
}
