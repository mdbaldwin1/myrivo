import { ContentWorkspacePoliciesForm } from "@/components/dashboard/content-workspace-policies-form";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";

export const dynamic = "force-dynamic";

export default function StoreWorkspaceContentWorkspacePoliciesPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <ContentWorkspacePoliciesForm header={<DashboardPageHeader title="Policies Page" description="Policy copy and FAQ content for customer trust." />} />
    </section>
  );
}
