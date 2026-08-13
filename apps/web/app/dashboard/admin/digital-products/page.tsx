import { redirect } from "next/navigation";
import { DigitalProductOperationsPanel } from "@/components/dashboard/admin/digital-product-operations-panel";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { hasGlobalRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GlobalUserRole } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardAdminDigitalProductsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("user_profiles").select("global_role").eq("id", user.id).maybeSingle<{ global_role: GlobalUserRole }>();
  if (!hasGlobalRole(profile?.global_role ?? "user", "admin")) redirect("/dashboard");
  return (
    <DashboardPageScaffold title="Digital Product Operations" description="Monitor and repair digital delivery without exposing customer data or access credentials." className="p-3">
      <DigitalProductOperationsPanel />
    </DashboardPageScaffold>
  );
}
