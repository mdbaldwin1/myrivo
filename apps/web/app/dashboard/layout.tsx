import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Image from "next/image";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { PageShell } from "@/components/layout/page-shell";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const bundle = await getOwnedStoreBundle(user.id);

  if (!bundle) {
    redirect("/login");
  }

  if (bundle.role === "customer") {
    redirect("/account");
  }

  return (
    <PageShell maxWidthClassName="max-w-7xl">
      <div className="space-y-5">
        <header className="rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
          <div className="flex items-center gap-2">
            <Image src="/brand/myrivo-mark.svg" alt="Myrivo logo" width={20} height={20} className="h-5 w-5 rounded-sm" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Myrivo</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold">{bundle.store.name}</h1>
            <p className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {bundle.store.status}
            </p>
          </div>
        </header>
        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <DashboardNav
            storeStatus={bundle.store.status}
            storeSlug={bundle.store.slug}
            activeStoreSlug={bundle.store.slug}
            stores={bundle.availableStores}
          />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </PageShell>
  );
}
