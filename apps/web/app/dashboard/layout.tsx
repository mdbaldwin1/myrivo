import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { DashboardMobileNavSheet } from "@/components/dashboard/dashboard-mobile-nav-sheet";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { buttonVariants } from "@/components/ui/button";
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
    .select("global_role")
    .eq("id", user.id)
    .maybeSingle<{ global_role: GlobalUserRole }>();
  const globalRole = profile?.global_role ?? "user";
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

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-7xl flex-col overflow-hidden px-4 py-6 md:px-8 md:py-8">
      <div className="min-h-0 flex flex-1 flex-col gap-5">
        <header className="shrink-0 rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Image src="/brand/myrivo-mark.svg" alt="Myrivo logo" width={20} height={20} className="h-5 w-5 rounded-sm" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Myrivo</p>
            </div>
            <DashboardMobileNavSheet activeStoreSlug={storeSlug} stores={availableStores} globalRole={globalRole} />
          </div>
          <div className="mt-2 flex min-h-10 flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold">{storeName}</h1>
            <div className="flex items-center gap-2">
              {storeStatus ? (
                <p className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {storeStatus}
                </p>
              ) : null}
              {storeSlug ? (
                <Link href={`/s/${storeSlug}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  View storefront
                </Link>
              ) : null}
            </div>
          </div>
        </header>
        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <DashboardNav activeStoreSlug={storeSlug} stores={availableStores} globalRole={globalRole} className="hidden lg:flex" />
          <div data-dashboard-scroll-container="true" className="min-h-0 min-w-0 overflow-y-auto pr-1">
            <div className="space-y-4 pb-1">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
