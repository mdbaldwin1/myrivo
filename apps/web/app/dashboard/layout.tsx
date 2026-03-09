import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardMobileNavSheet } from "@/components/dashboard/dashboard-mobile-nav-sheet";
import { DashboardHeaderStorefrontLink } from "@/components/dashboard/dashboard-header-storefront-link";
import { DashboardHeaderStoreSection } from "@/components/dashboard/dashboard-header-store-section";
import { DashboardHeaderNotifications } from "@/components/dashboard/dashboard-header-notifications";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { DashboardHeaderBackButton } from "@/components/dashboard/dashboard-header-back-button";
import { buttonVariants } from "@/components/ui/button";
import { hasStorePermission } from "@/lib/auth/roles";
import { resolveAccountNotificationPreferences } from "@/lib/notifications/preferences";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
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
  const bundle = await getOwnedStoreBundle(user.id, "staff");

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
    <main data-dashboard-shell="true" className="fixed inset-0 flex w-full flex-col overflow-hidden bg-stone-50">
      <header className="shrink-0 border-b border-border/70 bg-white/95 supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <DashboardHeaderBackButton />
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image src="/brand/myrivo-mark.svg" alt="Myrivo logo" width={20} height={20} className="h-5 w-5 rounded-sm" />
              <p className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:block">Myrivo</p>
            </Link>
            <span className="hidden h-4 w-px bg-border sm:block" />
            <DashboardHeaderStoreSection hasStoreAccess={hasStoreAccess} activeStoreSlug={storeSlug} storeStatus={storeStatus} stores={availableStores} />
          </div>
          <div className="flex items-center gap-2">
            <Link href="/docs" target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Docs
            </Link>
            <DashboardHeaderStorefrontLink storeSlug={storeSlug} />
            <DashboardHeaderNotifications storeSlug={storeSlug} initialNotificationSoundEnabled={notificationSoundEnabled} />
            <DashboardMobileNavSheet
              activeStoreSlug={storeSlug}
              stores={availableStores}
              globalRole={globalRole}
              userAvatarPath={userAvatarPath}
              initialTestModeEnabled={initialTestModeEnabled}
              canManageTestMode={canManageTestMode}
            />
          </div>
        </div>
      </header>
      <div className="min-h-0 flex flex-1 overflow-hidden">
        <DashboardNav
          activeStoreSlug={storeSlug}
          stores={availableStores}
          globalRole={globalRole}
          userDisplayName={userDisplayName}
          userEmail={userEmail}
          userAvatarPath={userAvatarPath}
          initialTestModeEnabled={initialTestModeEnabled}
          canManageTestMode={canManageTestMode}
          className="hidden w-72 shrink-0 border-r border-border/70 bg-stone-50 px-3 py-3 lg:flex"
        />
        <div data-dashboard-scroll-container="true" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-none bg-stone-50">
          <div className="flex min-h-full min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </main>
  );
}
