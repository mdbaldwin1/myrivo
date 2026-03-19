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
        initialFaviconPath={bundle.branding?.favicon_path ?? null}
        initialAppleTouchIconPath={bundle.branding?.apple_touch_icon_path ?? null}
        initialOgImagePath={bundle.branding?.og_image_path ?? null}
        initialTwitterImagePath={bundle.branding?.twitter_image_path ?? null}
        header={<DashboardPageHeader title="General" description="Core store identity and search metadata." />}
      />
    </section>
  );
}
