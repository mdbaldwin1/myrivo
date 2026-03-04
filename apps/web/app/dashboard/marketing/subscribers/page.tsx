import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StoreEmailSubscribersManager } from "@/components/dashboard/store-email-subscribers-manager";

export const dynamic = "force-dynamic";

export default function DashboardMarketingSubscribersPage() {
  return (
    <section className="space-y-4">
      <DashboardPageHeader
        title="Marketing · Email Subscribers"
        description="Manage newsletter signups captured from your storefront."
      />
      <StoreEmailSubscribersManager />
    </section>
  );
}

