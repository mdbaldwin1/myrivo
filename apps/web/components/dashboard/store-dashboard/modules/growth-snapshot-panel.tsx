import Link from "next/link";
import { AppAlert } from "@/components/ui/app-alert";
import { DataStat } from "@/components/ui/data-stat";
import { SectionCard } from "@/components/ui/section-card";
import type { StoreDashboardData } from "@/lib/dashboard/store-dashboard/store-dashboard-types";

type GrowthSnapshotPanelProps = {
  growth: StoreDashboardData["growth"];
  storeSlug: string;
  errorMessage?: string;
  retryHref: string;
};

export function GrowthSnapshotPanel({ growth, storeSlug, errorMessage, retryHref }: GrowthSnapshotPanelProps) {
  return (
    <SectionCard
      title="Growth Snapshot"
      description="Subscriber and promotion momentum for the current selected period."
      action={
        <div className="flex items-center gap-2 text-xs">
          <Link href={`/dashboard/stores/${storeSlug}/subscribers`} className="font-medium text-primary hover:underline">
            Subscribers
          </Link>
          <span className="text-muted-foreground">|</span>
          <Link href={`/dashboard/stores/${storeSlug}/promotions`} className="font-medium text-primary hover:underline">
            Promotions
          </Link>
        </div>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <AppAlert
          variant="warning"
          message={errorMessage ?? null}
          action={
            <Link href={retryHref} className="text-xs font-medium underline">
              Retry
            </Link>
          }
          className="sm:col-span-2"
        />
        <DataStat label="Subscribers" value={String(growth.subscribersTotal)} className="bg-card" />
        <DataStat label="Net New (Period)" value={String(growth.subscribersNetNew)} className="bg-card" />
        <DataStat label="Active Promotions" value={String(growth.activePromotions)} className="bg-card" />
        <DataStat label="Promo Redemptions" value={String(growth.promotionsRedeemed)} className="bg-card" />
      </div>
    </SectionCard>
  );
}
