import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StoreShippingRulesForm } from "@/components/dashboard/store-shipping-rules-form";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ storeSlug: string }> };

export default async function StoreWorkspaceShippingSettingsPage({ params }: PageProps) {
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
      <StoreShippingRulesForm
        header={<DashboardPageHeader title="Shipping" description="Flat-rate shipping options and pricing used during checkout." />}
      />
    </section>
  );
}
