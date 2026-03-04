import { redirect } from "next/navigation";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { TeamManager } from "@/components/dashboard/team-manager";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardStoreSettingsTeamPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const bundle = await getOwnedStoreBundle(user.id, "admin");
  if (!bundle) {
    redirect("/dashboard");
  }

  return (
    <section className="space-y-4">
      <DashboardPageHeader title="Team" description="Invite teammates and manage store-level access roles." />
      <TeamManager />
    </section>
  );
}
