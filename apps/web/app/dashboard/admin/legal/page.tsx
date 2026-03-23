import { redirect } from "next/navigation";
import { PlatformLegalPanel } from "@/components/dashboard/admin/platform-legal-panel";
import { PlatformPrivacyGovernancePanel } from "@/components/dashboard/admin/platform-privacy-governance-panel";
import { ContextHelpLink } from "@/components/dashboard/context-help-link";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { hasGlobalRole } from "@/lib/auth/roles";
import { fetchLegalAcceptances, fetchLegalDocumentsAndVersions } from "@/lib/platform/legal-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { GlobalUserRole } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardAdminLegalPage() {
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

  const admin = createSupabaseAdminClient();
  const [{ documents, versions }, acceptances] = await Promise.all([
    fetchLegalDocumentsAndVersions(admin),
    fetchLegalAcceptances(admin, {}, 200)
  ]);

  return (
    <DashboardPageScaffold
      title="Legal Governance"
      description="Manage Myrivo platform policies, storefront base templates, and consent records."
      className="p-3"
      action={<ContextHelpLink href="/docs/legal-governance-and-consent-ops#publishing-and-communication" context="admin_legal" label="Legal Ops Docs" />}
    >
      <div className="space-y-4">
        <PlatformPrivacyGovernancePanel />
        <PlatformLegalPanel
          initialPayload={{
            role: globalRole,
            documents,
            versions,
            acceptances
          }}
        />
      </div>
    </DashboardPageScaffold>
  );
}
