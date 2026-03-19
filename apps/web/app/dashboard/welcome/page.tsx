import { redirect } from "next/navigation";
import { DashboardWelcomeChoice } from "@/components/dashboard/dashboard-welcome-choice";
import { resolveWelcomeIntent } from "@/lib/auth/welcome-intent";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GlobalUserRole } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardWelcomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("global_role,metadata")
    .eq("id", user.id)
    .maybeSingle<{ global_role: GlobalUserRole; metadata: Record<string, unknown> | null }>();

  const intent = resolveWelcomeIntent(profile?.metadata);
  const storeBundle = await getOwnedStoreBundleForOptionalSlug(user.id, null, "staff");
  const hasStoreAccess = (storeBundle?.availableStores ?? []).length > 0;

  if (intent === "sell" && !hasStoreAccess) {
    redirect("/dashboard/stores/onboarding/new");
  }

  if (intent === "shop" || (intent === "sell" && hasStoreAccess)) {
    redirect("/dashboard");
  }

  return <DashboardWelcomeChoice hasStoreAccess={hasStoreAccess} />;
}
