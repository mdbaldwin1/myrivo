import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { buttonVariants } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
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
    .select("global_role,display_name,email")
    .eq("id", user.id)
    .maybeSingle<{ global_role: GlobalUserRole; display_name: string | null; email: string | null }>();
  const globalRole = profile?.global_role ?? "user";
  const userDisplayName = profile?.display_name ?? null;
  const userEmail = profile?.email ?? user.email ?? null;
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
    <PageShell maxWidthClassName="max-w-7xl">
      <div className="space-y-5">
        <header className="rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
          <div className="flex items-center gap-2">
            <Image src="/brand/myrivo-mark.svg" alt="Myrivo logo" width={20} height={20} className="h-5 w-5 rounded-sm" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Myrivo</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold">{storeName}</h1>
            <div className="flex items-center gap-2">
              {storeStatus ? (
                <p className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {storeStatus}
                </p>
              ) : null}
              {storeSlug ? (
                <Link
                  href={`/s/${storeSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  View storefront
                </Link>
              ) : null}
            </div>
          </div>
        </header>
        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <DashboardNav
            activeStoreSlug={storeSlug}
            stores={availableStores}
            globalRole={globalRole}
            userDisplayName={userDisplayName}
            userEmail={userEmail}
          />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </PageShell>
  );
}
