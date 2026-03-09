import { redirect } from "next/navigation";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { TeamManager } from "@/components/dashboard/team-manager";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ storeSlug: string }> };

export default async function StoreWorkspaceTeamSettingsPage({ params }: PageProps) {
  const { storeSlug } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const bundle = await getOwnedStoreBundleForSlug(user.id, storeSlug, "admin");
  if (!bundle) {
    redirect(`/dashboard/stores/${storeSlug}`);
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:p-4">
        <DashboardPageHeader title="Team" description="Invite teammates and manage store-level access roles." />
        <TeamManager />
      </div>
    </section>
  );
}
