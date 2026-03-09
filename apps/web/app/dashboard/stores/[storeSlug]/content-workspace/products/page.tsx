import { ContentWorkspaceProductsForm } from "@/components/dashboard/content-workspace-products-form";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";

export const dynamic = "force-dynamic";

export default function StoreWorkspaceContentWorkspaceProductsPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <ContentWorkspaceProductsForm
        header={<DashboardPageHeader title="Products Page" description="Product page merchandising content and copy controls." />}
      />
    </section>
  );
}
