import { BrandingSettingsForm } from "@/components/dashboard/branding-settings-form";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ storeSlug: string }> };

export default async function StoreWorkspaceBrandingSettingsPage({ params }: PageProps) {
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
      <BrandingSettingsForm
        initialBranding={bundle.branding}
        header={<DashboardPageHeader title="Branding" description="Global design tokens and storefront structural styling." />}
      />
    </section>
  );
}
