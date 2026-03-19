import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StorePrivacySettingsForm } from "@/components/dashboard/store-privacy-settings-form";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ storeSlug: string }> };

export default async function StoreWorkspacePrivacySettingsPage({ params }: PageProps) {
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
      <StorePrivacySettingsForm
        header={<DashboardPageHeader title="Privacy" description="Storefront privacy notices, shopper rights controls, and privacy requests." />}
      />
    </section>
  );
}
