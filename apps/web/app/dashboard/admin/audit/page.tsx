import { redirect } from "next/navigation";
import { ContextHelpLink } from "@/components/dashboard/context-help-link";
import { PlatformAuditPanel } from "@/components/dashboard/admin/platform-audit-panel";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { hasGlobalRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GlobalUserRole } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardAdminAuditPage() {
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
      title="Platform Audit"
      description="Inspect platform actions across stores, moderation, and governance."
      className="p-3"
      action={<ContextHelpLink href="/docs/audit-explorer-and-evidence#evidence-export-playbook" context="admin_audit" label="Audit Docs" />}
    >
      <PlatformAuditPanel />
    </DashboardPageScaffold>
  );
}
