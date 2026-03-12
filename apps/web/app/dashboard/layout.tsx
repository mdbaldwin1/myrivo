import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { hasStorePermission } from "@/lib/auth/roles";
import { getMissingRequiredLegalVersions } from "@/lib/legal/consent";
import { resolveAccountNotificationPreferences } from "@/lib/notifications/preferences";
import { resolveStoreSlugFromCurrentDashboardRoute } from "@/lib/stores/active-store";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
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

  const storeStatus = bundle?.store.status ?? null;
  const storeSlug = bundle?.store.slug ?? null;
  const availableStores = bundle?.availableStores ?? [];
  const hasStoreAccess = availableStores.length > 0 && Boolean(storeSlug);
  const canManageTestMode = bundle ? hasStorePermission(bundle.role, bundle.permissionsJson, "store.manage_billing") : false;

  const { data: billingProfile } = bundle
    ? await supabase
        .from("store_billing_profiles")
        .select("test_mode_enabled")
        .eq("store_id", bundle.store.id)
        .maybeSingle<{ test_mode_enabled: boolean }>()
    : { data: null as { test_mode_enabled: boolean } | null };
  const initialTestModeEnabled = Boolean(billingProfile?.test_mode_enabled);

  return (
    <DashboardShell
      activeStoreSlug={storeSlug}
      stores={availableStores}
      globalRole={globalRole}
      userDisplayName={userDisplayName}
      userEmail={userEmail}
      userAvatarPath={userAvatarPath}
      initialNotificationSoundEnabled={notificationSoundEnabled}
      initialTestModeEnabled={initialTestModeEnabled}
      canManageTestMode={canManageTestMode}
      hasStoreAccess={hasStoreAccess}
      storeStatus={storeStatus}
    >
      {children}
    </DashboardShell>
  );
}
