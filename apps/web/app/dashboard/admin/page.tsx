import { redirect } from "next/navigation";
import { ContextHelpLink } from "@/components/dashboard/context-help-link";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { PlatformConsole } from "@/components/dashboard/platform-console";
import { hasGlobalRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GlobalUserRole } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardAdminPage() {
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
      title="Admin Dashboard"
      description="Platform-wide governance, operations, and role controls."
      className="p-4 lg:p-4"
      action={<ContextHelpLink href="/docs/admin-dashboard-and-operations#operations-checklist" context="admin_dashboard" label="Admin Docs" />}
    >
      <PlatformConsole currentGlobalRole={globalRole} />
    </DashboardPageScaffold>
  );
}
