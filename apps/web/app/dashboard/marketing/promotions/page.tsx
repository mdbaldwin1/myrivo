import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { PromotionsManager } from "@/components/dashboard/promotions-manager";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardMarketingPromotionsPage() {
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

  const { data: promotions, error: promotionsError } = await supabase
    .from("promotions")
    .select("id,code,discount_type,discount_value,min_subtotal_cents,max_redemptions,times_redeemed,starts_at,ends_at,is_active,created_at")
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false });

  if (promotionsError) {
    throw new Error(promotionsError.message);
  }

  return (
    <section className="space-y-4">
      <DashboardPageHeader title="Marketing · Promotions" description="Create and manage discount offers." />
      <PromotionsManager initialPromotions={promotions ?? []} />
    </section>
  );
}

