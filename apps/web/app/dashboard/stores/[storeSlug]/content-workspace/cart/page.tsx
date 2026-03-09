import { ContentWorkspaceCartForm } from "@/components/dashboard/content-workspace-cart-form";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";

export const dynamic = "force-dynamic";

export default function StoreWorkspaceContentWorkspaceCartPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <ContentWorkspaceCartForm header={<DashboardPageHeader title="Cart Page" description="Cart and pre-checkout messaging and copy." />} />
    </section>
  );
}
