import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StoreEmailSubscribersManager } from "@/components/dashboard/store-email-subscribers-manager";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ storeSlug: string }>;
};

export default async function StoreWorkspaceSubscribersPage({ params }: PageProps) {
  const { storeSlug } = await params;
  return (
    <section className="space-y-3 p-3">
      <DashboardPageHeader title="Subscribers" description="Manage newsletter signups captured from your storefront." />
      <StoreEmailSubscribersManager storeSlug={storeSlug} />
    </section>
  );
}
