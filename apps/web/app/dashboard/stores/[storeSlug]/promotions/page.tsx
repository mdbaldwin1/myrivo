import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { PromotionsManager } from "@/components/dashboard/promotions-manager";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ storeSlug: string }> };

export default async function StoreWorkspacePromotionsPage({ params }: PageProps) {
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

  const { data: promotions, error: promotionsError } = await supabase
    .from("promotions")
    .select("id,code,discount_type,discount_value,min_subtotal_cents,max_redemptions,times_redeemed,starts_at,ends_at,is_active,created_at")
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false });

  if (promotionsError) {
    throw new Error(promotionsError.message);
  }

  return (
    <section className="space-y-4 p-4 lg:p-4">
      <DashboardPageHeader title="Promotions" description="Create and manage discount offers." />
      <PromotionsManager initialPromotions={promotions ?? []} />
    </section>
  );
}
