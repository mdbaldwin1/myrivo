import { redirect } from "next/navigation";
import { CustomerAccountDashboardPanels } from "@/components/customer/customer-account-dashboard-panels";
import { CustomerProfileSettings } from "@/components/customer/customer-profile-settings";
import { PageShell } from "@/components/layout/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CustomerAccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: savedStores }, { data: savedItems }, { data: carts }, { data: orders }] = await Promise.all([
    supabase.from("user_profiles").select("display_name,avatar_path").eq("id", user.id).maybeSingle<{ display_name: string | null; avatar_path: string | null }>(),
    supabase
      .from("customer_saved_stores")
      .select("id,stores(id,name,slug,status)")
      .eq("user_id", user.id),
    supabase
      .from("customer_saved_items")
      .select("id,products(id,title),product_variants(id,title),stores(id,name,slug,status)")
      .eq("user_id", user.id),
    supabase
      .from("customer_carts")
      .select("id,stores(id,name,slug),updated_at")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("orders")
      .select("id,total_cents,status,created_at,stores(name,slug)")
      .eq("customer_email", user.email ?? "")
      .order("created_at", { ascending: false })
      .limit(15)
  ]);

  return (
    <PageShell maxWidthClassName="max-w-5xl">
      <section className="space-y-4">
        <SectionCard title="Customer Dashboard">
          <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
        </SectionCard>

        <SectionCard title="Profile">
          <CustomerProfileSettings email={user.email ?? null} displayName={profile?.display_name ?? null} initialAvatarPath={profile?.avatar_path ?? null} />
        </SectionCard>

        <CustomerAccountDashboardPanels
          initialSavedStores={savedStores ?? []}
          initialSavedItems={savedItems ?? []}
          carts={carts ?? []}
          orders={orders ?? []}
        />
      </section>
    </PageShell>
  );
}
