import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { SectionCard } from "@/components/ui/section-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardAccountSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name,global_role")
    .eq("id", user.id)
    .maybeSingle<{ display_name: string | null; global_role: "user" | "admin" | "support" }>();

  return (
    <section className="space-y-4">
      <DashboardPageHeader title="Profile & Account" description="Identity, role visibility, and account-level preferences." />
      <SectionCard title="Signed-In User">
        <div className="space-y-1 text-sm">
          <p>
            <span className="font-medium">Email:</span> {user.email}
          </p>
          <p>
            <span className="font-medium">Display name:</span> {profile?.display_name ?? "Not set"}
          </p>
          <p>
            <span className="font-medium">Platform role:</span> {(profile?.global_role ?? "user").toUpperCase()}
          </p>
        </div>
      </SectionCard>
      <SectionCard title="Customer View Shortcut">
        <p className="text-sm text-muted-foreground">
          Open <a className="underline-offset-4 hover:underline" href="/account">/account</a> to view saved stores, saved items, and active carts.
        </p>
      </SectionCard>
    </section>
  );
}
