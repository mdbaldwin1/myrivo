import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { PickupSettingsManager } from "@/components/dashboard/pickup-settings-manager";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ storeSlug: string }> };

export default async function StoreWorkspaceFulfillmentSettingsPage({ params }: PageProps) {
  const { storeSlug } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const bundle = await getOwnedStoreBundleForSlug(user.id, storeSlug);
  if (!bundle) {
    return null;
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <PickupSettingsManager
        showShippingOfferSettings
        header={
          <DashboardPageHeader
            title="Fulfillment"
            description="Manage how customers receive orders, including shipping, pickup availability, locations, and scheduling."
          />
        }
      />
    </section>
  );
}
