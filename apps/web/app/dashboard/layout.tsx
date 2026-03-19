import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { resolveStoreAnalyticsAccessByStoreId } from "@/lib/analytics/access";
import { getMissingRequiredLegalVersions, recordPendingSignupLegalAcceptances } from "@/lib/legal/consent";
import { resolveAccountNotificationPreferences } from "@/lib/notifications/preferences";
import { resolveStoreSlugFromCurrentDashboardRoute } from "@/lib/stores/active-store";
import { getStoreOnboardingProgressForStore } from "@/lib/stores/onboarding";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GlobalUserRole } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await recordPendingSignupLegalAcceptances(supabase, {
    userId: user.id,
    userMetadata: user.user_metadata
  });

  const missingLegalVersions = await getMissingRequiredLegalVersions(supabase, user.id);
  if (missingLegalVersions.length > 0) {
    redirect("/legal/consent?returnTo=%2Fdashboard");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("global_role,display_name,email,avatar_path,metadata")
    .eq("id", user.id)
    .maybeSingle<{
      global_role: GlobalUserRole;
      display_name: string | null;
      email: string | null;
      avatar_path: string | null;
      metadata: Record<string, unknown>;
    }>();
  const globalRole = profile?.global_role ?? "user";
  const userDisplayName = profile?.display_name ?? null;
  const userEmail = profile?.email ?? user.email ?? null;
  const userAvatarPath = profile?.avatar_path ?? null;
  const notificationSoundEnabled = resolveAccountNotificationPreferences(profile?.metadata).notificationSoundEnabled;
  const routeStoreSlug = await resolveStoreSlugFromCurrentDashboardRoute();
  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, routeStoreSlug, "staff");
  const admin = createSupabaseAdminClient();

  const storeStatus = bundle?.store.status ?? null;
  const storeSlug = bundle?.store.slug ?? null;
  const storeOnboardingProgress = storeSlug ? await getStoreOnboardingProgressForStore(user.id, storeSlug) : null;
  const availableStores = bundle?.availableStores ?? [];
  const hasStoreAccess = availableStores.length > 0 && Boolean(storeSlug);
  const analyticsAccess = bundle ? await resolveStoreAnalyticsAccessByStoreId(admin, bundle.store.id) : null;

  return (
    <DashboardShell
      activeStoreSlug={storeSlug}
      stores={availableStores}
      globalRole={globalRole}
      userDisplayName={userDisplayName}
      userEmail={userEmail}
      userAvatarPath={userAvatarPath}
      initialNotificationSoundEnabled={notificationSoundEnabled}
      analyticsDashboardEnabled={analyticsAccess?.dashboardEnabled ?? false}
      hasStoreAccess={hasStoreAccess}
      storeStatus={storeStatus}
      storeOnboardingProgress={storeOnboardingProgress}
    >
      {children}
    </DashboardShell>
  );
}
