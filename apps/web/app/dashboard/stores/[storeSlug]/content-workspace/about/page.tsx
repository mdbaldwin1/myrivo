import { ContentWorkspaceAboutForm } from "@/components/dashboard/content-workspace-about-form";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";

export const dynamic = "force-dynamic";

export default function StoreWorkspaceContentWorkspaceAboutPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <ContentWorkspaceAboutForm header={<DashboardPageHeader title="About Page" description="Brand story article and structured sections." />} />
    </section>
  );
}
