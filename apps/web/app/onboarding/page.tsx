import { redirect } from "next/navigation";
import { resolveAuthenticatedWorkspacePath } from "@/lib/auth/authenticated-workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signup?returnTo=%2Fdashboard%2Fwelcome");
  }

  redirect(await resolveAuthenticatedWorkspacePath(user.id));
}
