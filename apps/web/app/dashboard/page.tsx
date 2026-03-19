import { DashboardHomeShell } from "@/components/dashboard/dashboard-home-shell";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { getDashboardHomeData } from "@/lib/dashboard/home/get-dashboard-home-data";
import { resolveCustomerStorefrontLinksBySlug } from "@/lib/customer/storefront-links";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GlobalUserRole } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const adminSupabase = createSupabaseAdminClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: profile }, { data: savedStores }, { data: savedItems }, { data: carts }, { data: orders }] = await Promise.all([
    supabase.from("user_profiles").select("global_role").eq("id", user.id).maybeSingle<{ global_role: GlobalUserRole }>(),
    supabase.from("customer_saved_stores").select("id,stores(id,name,slug,status),store_id").eq("user_id", user.id),
    supabase.from("customer_saved_items").select("id,products(id,title),product_variants(id,title),stores(id,name,slug,status)").eq("user_id", user.id),
    supabase.from("customer_carts").select("id,stores(id,name,slug),updated_at").eq("user_id", user.id).eq("status", "active"),
    supabase
      .from("orders")
      .select("id,total_cents,status,fulfillment_status,created_at,stores(name,slug)")
      .eq("customer_email", user.email ?? "")
      .order("created_at", { ascending: false })
      .limit(15)
  ]);

  const role = profile?.global_role ?? "user";
  const dashboardHomeData = await getDashboardHomeData({
    supabase,
    adminSupabase,
    userId: user.id,
    userEmail: user.email ?? null,
    role
  });
  const storeSlugs = [
    ...(savedStores ?? []).map((entry) => {
      const store = Array.isArray(entry.stores) ? entry.stores[0] : entry.stores;
      return store?.slug ?? "";
    }),
    ...(savedItems ?? []).map((entry) => {
      const store = Array.isArray(entry.stores) ? entry.stores[0] : entry.stores;
      return store?.slug ?? "";
    }),
    ...(carts ?? []).map((entry) => {
      const store = Array.isArray(entry.stores) ? entry.stores[0] : entry.stores;
      return store?.slug ?? "";
    }),
    ...(orders ?? []).map((entry) => {
      const store = Array.isArray(entry.stores) ? entry.stores[0] : entry.stores;
      return store?.slug ?? "";
    })
  ];
  const storefrontLinksBySlug = await resolveCustomerStorefrontLinksBySlug(storeSlugs);

  return (
    <DashboardPageScaffold
      title="Dashboard"
      description="Your saved storefront activity, carts, and orders."
      className="p-3"
    >
      <DashboardHomeShell
        data={dashboardHomeData}
        storefrontLinksBySlug={storefrontLinksBySlug}
        legacyPanelProps={{
          initialSavedStores: savedStores ?? [],
          initialSavedItems: savedItems ?? [],
          carts: carts ?? [],
          orders: orders ?? []
        }}
      />
    </DashboardPageScaffold>
  );
}
