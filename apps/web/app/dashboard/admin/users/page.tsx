import { redirect } from "next/navigation";
import { ContextHelpLink } from "@/components/dashboard/context-help-link";
import { PlatformUsersPanel } from "@/components/dashboard/admin/platform-users-panel";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { hasGlobalRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GlobalUserRole } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardAdminUsersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("global_role")
    .eq("id", user.id)
    .maybeSingle<{ global_role: GlobalUserRole }>();
  const globalRole = profile?.global_role ?? "user";

  if (!hasGlobalRole(globalRole, "support")) {
    redirect("/dashboard");
  }

  return (
    <DashboardPageScaffold
      title="Users"
      description="Manage platform users and global roles."
      className="p-3"
      action={<ContextHelpLink href="/docs/admin-dashboard-and-operations#operations-checklist" context="admin_users" label="Admin Docs" />}
    >
      <PlatformUsersPanel />
    </DashboardPageScaffold>
  );
}
