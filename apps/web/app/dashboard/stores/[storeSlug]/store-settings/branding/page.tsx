import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StorefrontStudioHandoffPanel } from "@/components/dashboard/storefront-studio-handoff-panel";
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
      <div className="space-y-3 p-3">
        <DashboardPageHeader title="Branding" description="Theme tokens and storefront presentation now belong in Storefront Studio." />
        <StorefrontStudioHandoffPanel
          title="Branding has moved"
          description="Colors, typography, layout, navigation, and browser/social assets now live in Storefront Studio so you can judge them against the real storefront canvas."
          href={`/dashboard/stores/${storeSlug}/storefront-studio`}
          ctaLabel="Open branding in Studio"
          note="This route is being retired as part of the unified storefront-builder migration."
        />
      </div>
    </section>
  );
}
