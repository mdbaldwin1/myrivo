import { ContextHelpLink } from "@/components/dashboard/context-help-link";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DomainManager } from "@/components/dashboard/domain-manager";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ storeSlug: string }>;
};

export default async function StoreWorkspaceDomainSettingsPage({ params }: PageProps) {
  const { storeSlug } = await params;

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:p-4">
        <DashboardPageHeader
          title="Domains"
          description="Custom storefront domains, DNS verification, and primary domain routing."
          action={
            <ContextHelpLink href="/docs/getting-started#create-your-workspace" context="store_settings_domains" storeSlug={storeSlug} label="Domain Help" />
          }
        />
        <DomainManager />
      </div>
    </section>
  );
}
