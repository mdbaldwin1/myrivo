import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StoreEmailSubscribersManager } from "@/components/dashboard/store-email-subscribers-manager";

export const dynamic = "force-dynamic";

export default function StoreWorkspaceSubscribersPage() {
  return (
    <section className="space-y-4 p-4 lg:p-4">
      <DashboardPageHeader title="Subscribers" description="Manage newsletter signups captured from your storefront." />
      <StoreEmailSubscribersManager />
    </section>
  );
}
