import Link from "next/link";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { PendingStoreInvitesCard } from "@/components/dashboard/pending-store-invites-card";
import { StoreHubShell } from "@/components/dashboard/store-hub/store-hub-shell";
import { Button } from "@/components/ui/button";
import { getPendingStoreInvitesByEmail } from "@/lib/account/pending-store-invites";
import { getStoreHubData } from "@/lib/dashboard/store-hub/get-store-hub-data";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GlobalUserRole } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardStoresPage() {
  const supabase = await createSupabaseServerClient();
  const adminSupabase = createSupabaseAdminClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: profile }, bundle, pendingInvites] = await Promise.all([
    supabase.from("user_profiles").select("global_role").eq("id", user.id).maybeSingle<{ global_role: GlobalUserRole }>(),
    getOwnedStoreBundle(user.id, "staff"),
    getPendingStoreInvitesByEmail(adminSupabase, user.email ?? null)
  ]);

  const stores = (bundle?.availableStores ?? []).filter((store) => store.role !== "customer");
  const storeIds = stores.map((store) => store.id);

  const { data: brandingRows } = storeIds.length
    ? await supabase.from("store_branding").select("store_id,logo_path").in("store_id", storeIds)
    : { data: [] as Array<{ store_id: string; logo_path: string | null }> };

  const logoByStoreId = new Map((brandingRows ?? []).map((row) => [row.store_id, row.logo_path]));

  const data = await getStoreHubData({
    supabase,
    stores,
    role: profile?.global_role ?? "user",
    range: "7d",
    compare: false
  });

  return (
    <DashboardPageScaffold
      title="Store Hub"
      description="All of your accessible stores in one place."
      className="p-3"
      action={
        <Button size="sm" asChild>
          <Link href="/onboarding">Create Store</Link>
        </Button>
      }
    >
      {pendingInvites.length > 0 ? <PendingStoreInvitesCard invites={pendingInvites} /> : null}
      <StoreHubShell data={data} logoByStoreId={logoByStoreId} />
    </DashboardPageScaffold>
  );
}
