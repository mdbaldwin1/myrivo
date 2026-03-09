import { CheckoutExperienceSettingsForm } from "@/components/dashboard/checkout-experience-settings-form";
import { ContextHelpLink } from "@/components/dashboard/context-help-link";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ storeSlug: string }> };

export default async function StoreWorkspaceCheckoutExperienceSettingsPage({ params }: PageProps) {
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
      <CheckoutExperienceSettingsForm
        header={
          <DashboardPageHeader
            title="Checkout Experience"
            description="Configure checkout form behavior and buyer-facing prompts."
            action={
              <ContextHelpLink
                href="/docs/getting-started#configure-launch-settings"
                context="store_settings_checkout_experience"
                storeSlug={storeSlug}
                label="Checkout Help"
              />
            }
          />
        }
      />
    </section>
  );
}
