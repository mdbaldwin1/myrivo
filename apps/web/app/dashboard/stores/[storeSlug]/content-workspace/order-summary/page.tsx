import { ContentWorkspaceOrderSummaryForm } from "@/components/dashboard/content-workspace-order-summary-form";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";

export const dynamic = "force-dynamic";

export default function StoreWorkspaceContentWorkspaceOrderSummaryPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <ContentWorkspaceOrderSummaryForm
        header={<DashboardPageHeader title="Order Summary" description="Post-checkout confirmation page copy and messaging." />}
      />
    </section>
  );
}
