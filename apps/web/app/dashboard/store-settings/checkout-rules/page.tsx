import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { PickupSettingsManager } from "@/components/dashboard/pickup-settings-manager";
import { StorePoliciesForm } from "@/components/dashboard/store-policies-form";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardStoreSettingsCheckoutRulesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const bundle = await getOwnedStoreBundle(user.id);
  if (!bundle) {
    return null;
  }

  return (
    <section className="space-y-4">
      <DashboardPageHeader title="Checkout Rules" description="Fulfillment methods, fee behavior, and order-note policies." />
      <StorePoliciesForm initialSettings={bundle.settings} mode="checkout" title="Checkout Rules" />
      <PickupSettingsManager />
    </section>
  );
}
