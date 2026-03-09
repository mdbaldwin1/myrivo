import { ContentWorkspaceHomeForm } from "@/components/dashboard/content-workspace-home-form";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";

export const dynamic = "force-dynamic";

export default function StoreWorkspaceContentWorkspaceHomePage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <ContentWorkspaceHomeForm
        header={<DashboardPageHeader title="Home Page" description="High-frequency storefront storytelling and merchandising content." />}
      />
    </section>
  );
}
