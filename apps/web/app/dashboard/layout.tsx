import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardMobileNavSheet } from "@/components/dashboard/dashboard-mobile-nav-sheet";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { DashboardHeaderBackButton } from "@/components/dashboard/dashboard-header-back-button";
import { DashboardHeaderStoreControl } from "@/components/dashboard/dashboard-header-store-control";
import { buttonVariants } from "@/components/ui/button";
import { hasStorePermission } from "@/lib/auth/roles";
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
    .select("global_role,display_name,email,avatar_path")
    .eq("id", user.id)
    .maybeSingle<{ global_role: GlobalUserRole; display_name: string | null; email: string | null; avatar_path: string | null }>();
  const globalRole = profile?.global_role ?? "user";
  const userDisplayName = profile?.display_name ?? null;
  const userEmail = profile?.email ?? user.email ?? null;
  const userAvatarPath = profile?.avatar_path ?? null;
  const bundle = await getOwnedStoreBundle(user.id, "staff");

  if (!bundle && globalRole === "user") {
    redirect("/login");
  }

  if (bundle && bundle.role === "customer") {
    redirect("/account");
  }

  const storeName = bundle?.store.name ?? "Platform";
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
            <Link href="/myrivo" className="flex items-center gap-2">
              <Image src="/brand/myrivo-mark.svg" alt="Myrivo logo" width={20} height={20} className="h-5 w-5 rounded-sm" />
              <p className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:block">Myrivo</p>
            </Link>
            <span className="hidden h-4 w-px bg-border sm:block" />
            {hasStoreAccess ? (
              <div className="max-w-[min(26rem,62vw)]">
                <DashboardHeaderStoreControl
                  key={storeSlug}
                  activeStoreSlug={storeSlug!}
                  stores={availableStores}
                />
              </div>
            ) : (
              <h1 className="truncate text-base font-semibold sm:text-lg">{storeName}</h1>
            )}
            {storeStatus ? (
              <p className="shrink-0 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {storeStatus}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {storeSlug ? (
              <Link href={`/s/${storeSlug}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "default", size: "sm" })}>
                View storefront
              </Link>
            ) : null}
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
        <div data-dashboard-scroll-container="true" className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-none bg-stone-50">
          <div className="space-y-4 px-4 py-4 lg:px-6 lg:py-5">{children}</div>
        </div>
      </div>
    </main>
  );
}
