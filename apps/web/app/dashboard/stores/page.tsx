import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { PendingStoreInvitesCard } from "@/components/dashboard/pending-store-invites-card";
import { StoreHubShell } from "@/components/dashboard/store-hub/store-hub-shell";
import { getPendingStoreInvitesByEmail } from "@/lib/account/pending-store-invites";
import { getStoreHubData } from "@/lib/dashboard/store-hub/get-store-hub-data";
import type { StoreHubRange } from "@/lib/dashboard/store-hub/store-hub-types";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GlobalUserRole } from "@/types/database";

export const dynamic = "force-dynamic";

type DashboardStoresPageProps = {
  searchParams?: Promise<{ range?: string; compare?: string }>;
};

function normalizeRange(value: string | undefined): StoreHubRange {
  if (value === "today" || value === "7d" || value === "30d") {
    return value;
  }
  return "7d";
}

export default async function DashboardStoresPage({ searchParams }: DashboardStoresPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const range = normalizeRange(resolvedSearchParams?.range);
  const compare = resolvedSearchParams?.compare === "1" || resolvedSearchParams?.compare === "true";

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

  const stores = bundle?.availableStores ?? [];
  const storeIds = stores.map((store) => store.id);

  const { data: brandingRows } = storeIds.length
    ? await supabase.from("store_branding").select("store_id,logo_path").in("store_id", storeIds)
    : { data: [] as Array<{ store_id: string; logo_path: string | null }> };

  const logoByStoreId = new Map((brandingRows ?? []).map((row) => [row.store_id, row.logo_path]));

  const data = await getStoreHubData({
    supabase,
    stores,
    role: profile?.global_role ?? "user",
    range,
    compare
  });

  return (
    <DashboardPageScaffold
      title="Store Hub"
      description="Portfolio command center across your stores with prioritized operational actions."
      className="p-3"
    >
      {pendingInvites.length > 0 ? <PendingStoreInvitesCard invites={pendingInvites} /> : null}
      <StoreHubShell data={data} logoByStoreId={logoByStoreId} />
    </DashboardPageScaffold>
  );
}
