import { DataStat } from "@/components/ui/data-stat";
import type { StoreHubData } from "@/lib/dashboard/store-hub/store-hub-types";

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDelta(value: number | "new" | null) {
  if (value === null) {
    return "--";
  }
  if (value === "new") {
    return "New";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

type StoreHubSummaryCardsProps = {
  summary: StoreHubData["summary"];
};

export function StoreHubSummaryCards({ summary }: StoreHubSummaryCardsProps) {
  return (
    <section aria-label="Store hub summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <DataStat label="Stores" value={String(summary.storesTotal)} className="bg-card" />
      <DataStat label="Active" value={String(summary.storesActive)} className="bg-card" />
      <DataStat label="Pending Review" value={String(summary.storesPendingReview)} className="bg-card" />
      <DataStat label="Needs Attention" value={String(summary.storesWithCriticalAlerts)} className="bg-card" />
      <DataStat label="7d Gross" value={formatCurrency(summary.grossRevenueCents)} className="bg-card" />
      <DataStat label="Gross Delta" value={formatDelta(summary.grossRevenueDeltaPct)} className="bg-card" />
    </section>
  );
}
