import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StoreSettingsForm } from "@/components/dashboard/store-settings-form";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardStoreSettingsProfilePage() {
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
      <DashboardPageHeader title="General" description="Low-frequency store identity and publish-state controls." />
      <StoreSettingsForm initialStore={bundle.store} initialLogoPath={bundle.branding?.logo_path ?? null} />
    </section>
  );
}
