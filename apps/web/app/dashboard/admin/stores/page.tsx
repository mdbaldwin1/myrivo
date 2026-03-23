import { redirect } from "next/navigation";
import { ContextHelpLink } from "@/components/dashboard/context-help-link";
import { PlatformStoresPanel } from "@/components/dashboard/admin/platform-stores-panel";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { hasGlobalRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GlobalUserRole } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardAdminStoresPage() {
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
      title="Stores"
      description="Browse every store on the platform and handle approval work in one place."
      className="p-3"
      action={<ContextHelpLink href="/docs/store-governance-and-approvals#approval-workflow" context="admin_store_governance" label="Governance Docs" />}
    >
      <PlatformStoresPanel />
    </DashboardPageScaffold>
  );
}
