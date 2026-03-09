import { ContentWorkspaceEmailsForm } from "@/components/dashboard/content-workspace-emails-form";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";

export const dynamic = "force-dynamic";

export default function StoreWorkspaceContentWorkspaceEmailsPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <ContentWorkspaceEmailsForm
        header={<DashboardPageHeader title="Emails" description="Newsletter and transactional email copy controls." />}
      />
    </section>
  );
}
