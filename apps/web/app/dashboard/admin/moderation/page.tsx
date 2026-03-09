import { redirect } from "next/navigation";
import { ContextHelpLink } from "@/components/dashboard/context-help-link";
import { PlatformModerationPanel } from "@/components/dashboard/admin/platform-moderation-panel";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { hasGlobalRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GlobalUserRole } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardAdminModerationPage() {
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
      title="Moderation"
      description="Review pending customer content and moderate at the platform level."
      className="p-4 lg:p-4"
      action={
        <ContextHelpLink
          href="/docs/moderation-workflows-and-escalation#moderation-sla-and-escalation"
          context="admin_moderation"
          label="Moderation Docs"
        />
      }
    >
      <PlatformModerationPanel />
    </DashboardPageScaffold>
  );
}
