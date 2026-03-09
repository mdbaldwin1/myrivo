import { ContentWorkspaceEmailsForm } from "@/components/dashboard/content-workspace-emails-form";
import { ContextHelpLink } from "@/components/dashboard/context-help-link";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ storeSlug: string }>;
};

export default async function StoreWorkspaceContentWorkspaceEmailsPage({ params }: PageProps) {
  const { storeSlug } = await params;

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <ContentWorkspaceEmailsForm
        header={
          <DashboardPageHeader
            title="Emails"
            description="Newsletter and transactional email copy controls."
            action={
              <ContextHelpLink
                href="/docs/content-workspace-and-branding#content-workspace-surfaces"
                context="content_workspace_emails"
                storeSlug={storeSlug}
                label="Email Content Help"
              />
            }
          />
        }
      />
    </section>
  );
}
