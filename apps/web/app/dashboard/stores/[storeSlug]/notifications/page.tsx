import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { NotificationsFeed } from "@/components/dashboard/notifications-feed";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ storeSlug: string }>;
};

export default async function StoreWorkspaceNotificationsPage({ params }: PageProps) {
  const { storeSlug } = await params;

  return (
    <section className="space-y-4 p-4 lg:p-4">
      <div className="w-full space-y-4">
        <DashboardPageHeader
          title="Notifications"
          description="Track operational alerts, order events, and system warnings for this store workspace."
        />
        <div className="rounded-lg border border-border/70 bg-white p-4 shadow-sm">
          <NotificationsFeed storeSlug={storeSlug} mode="full" />
        </div>
      </div>
    </section>
  );
}
