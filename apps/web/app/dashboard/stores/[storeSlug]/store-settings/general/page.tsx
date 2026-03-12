import { BillingPlanSettings } from "@/components/dashboard/billing-plan-settings";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StoreSettingsForm } from "@/components/dashboard/store-settings-form";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ storeSlug: string }> };

export default async function StoreWorkspaceGeneralSettingsPage({ params }: PageProps) {
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
      <StoreSettingsForm
        initialStore={bundle.store}
        initialLogoPath={bundle.branding?.logo_path ?? null}
        header={<DashboardPageHeader title="General" description="Store review workflow, billing, and SEO metadata belong in Store Settings." />}
        supplementalContent={<BillingPlanSettings title="Billing Plan" />}
      />
    </section>
  );
}
