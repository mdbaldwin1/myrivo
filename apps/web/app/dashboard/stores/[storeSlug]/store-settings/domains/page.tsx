import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DomainManager } from "@/components/dashboard/domain-manager";

export const dynamic = "force-dynamic";

export default function StoreWorkspaceDomainSettingsPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:p-4">
        <DashboardPageHeader title="Domains" description="Custom storefront domains, DNS verification, and primary domain routing." />
        <DomainManager />
      </div>
    </section>
  );
}
