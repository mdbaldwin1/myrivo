import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { PickupSettingsManager } from "@/components/dashboard/pickup-settings-manager";
import { StorePoliciesForm } from "@/components/dashboard/store-policies-form";
import { Button } from "@/components/ui/button";
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
      <DashboardPageHeader
        title="Checkout Rules"
        description="Fulfillment methods, fee behavior, and order-note policies."
        action={
          <div className="flex items-center gap-2">
            <Button type="submit" form="store-policies-form" name="intent" value="discard" variant="outline">
              Discard
            </Button>
            <Button type="submit" form="store-policies-form" name="intent" value="save">
              Save
            </Button>
          </div>
        }
      />
      <StorePoliciesForm initialSettings={bundle.settings} mode="checkout" title="Checkout Rules" />
      <PickupSettingsManager />
    </section>
  );
}
