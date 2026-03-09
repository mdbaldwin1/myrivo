import { BillingPlanSettings } from "@/components/dashboard/billing-plan-settings";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StoreSeoChecklist } from "@/components/dashboard/store-seo-checklist";
import { StoreSettingsForm } from "@/components/dashboard/store-settings-form";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { isMissingColumnInSchemaCache } from "@/lib/supabase/error-classifiers";
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

  const [domainResult, productSeoResult] = await Promise.all([
    supabase
      .from("store_domains")
      .select("id")
      .eq("store_id", bundle.store.id)
      .eq("verification_status", "verified")
      .eq("is_primary", true)
      .limit(1),
    supabase
      .from("products")
      .select("id,image_alt_text,status")
      .eq("store_id", bundle.store.id)
      .eq("status", "active")
      .returns<Array<{ id: string; image_alt_text: string | null; status: "draft" | "active" | "archived" }>>()
  ]);
  const hasVerifiedPrimaryDomain = Boolean((domainResult.data ?? []).length > 0);
  let activeProducts = productSeoResult.data ?? [];
  if (isMissingColumnInSchemaCache(productSeoResult.error, "image_alt_text")) {
    const legacy = await supabase
      .from("products")
      .select("id,status")
      .eq("store_id", bundle.store.id)
      .eq("status", "active")
      .returns<Array<{ id: string; status: "draft" | "active" | "archived" }>>();
    activeProducts = (legacy.data ?? []).map((product) => ({ ...product, image_alt_text: null }));
  }
  const activeProductsMissingImageAltCount = activeProducts.filter((product) => !product.image_alt_text?.trim()).length;

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <StoreSettingsForm
        initialStore={bundle.store}
        initialLogoPath={bundle.branding?.logo_path ?? null}
        header={
          <>
            <DashboardPageHeader title="General" description="Low-frequency store identity and publish-state controls." />
            <BillingPlanSettings title="Billing Plan" editable />
            <StoreSeoChecklist
              storeSlug={bundle.store.slug}
              hasVerifiedPrimaryDomain={hasVerifiedPrimaryDomain}
              activeProductCount={activeProducts.length}
              activeProductsMissingImageAltCount={activeProductsMissingImageAltCount}
              hasStoreSeoTitle={Boolean(bundle.settings?.seo_title?.trim())}
              hasStoreSeoDescription={Boolean(bundle.settings?.seo_description?.trim())}
            />
          </>
        }
      />
    </section>
  );
}
