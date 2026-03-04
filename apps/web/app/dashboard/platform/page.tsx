import { redirect } from "next/navigation";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { PlatformConsole } from "@/components/dashboard/platform-console";
import { hasGlobalRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GlobalUserRole } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPlatformPage() {
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
    <section className="space-y-4">
      <DashboardPageHeader title="Platform Console" description="Platform-wide visibility and user-role controls." />
      <PlatformConsole currentGlobalRole={globalRole} />
    </section>
  );
}

