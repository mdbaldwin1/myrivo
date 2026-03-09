import Link from "next/link";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { StoreDashboardShell } from "@/components/dashboard/store-dashboard/store-dashboard-shell";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { getStoreDashboardData } from "@/lib/dashboard/store-dashboard/get-store-dashboard-data";
import type { StoreDashboardDateRange } from "@/lib/dashboard/store-dashboard/store-dashboard-types";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type StoreWorkspacePageProps = {
  params: Promise<{ storeSlug: string }>;
  searchParams?: Promise<{ range?: string; compare?: string }>;
};

function normalizeRange(rawRange: string | undefined): StoreDashboardDateRange {
  if (rawRange === "today" || rawRange === "7d" || rawRange === "30d") {
    return rawRange;
  }
  return "7d";
}

export default async function StoreWorkspacePage({ params, searchParams }: StoreWorkspacePageProps) {
  const { storeSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const bundle = await getOwnedStoreBundleForSlug(user.id, storeSlug, "staff");
  const activeStore = bundle?.store ?? null;

  if (!activeStore) {
    return null;
  }

  const range = normalizeRange(resolvedSearchParams?.range);
  const compare = resolvedSearchParams?.compare === "1" || resolvedSearchParams?.compare === "true";
  const retryParams = new URLSearchParams();
  retryParams.set("range", range);
  if (compare) {
    retryParams.set("compare", "1");
  }
  const retryHref = `/dashboard/stores/${activeStore.slug}?${retryParams.toString()}`;

  let data: Awaited<ReturnType<typeof getStoreDashboardData>> | null = null;
  let loadError: string | null = null;

  try {
    data = await getStoreDashboardData({
      supabase,
      store: activeStore,
      range,
      compare
    });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load dashboard data.";
  }

  if (loadError || !data) {
    return (
      <DashboardPageScaffold title={`${activeStore.name} Control Tower`} description="Dashboard data is temporarily unavailable." className="p-4 lg:p-4">
        <AppAlert
          variant="error"
          message={loadError ?? "Unable to load dashboard data."}
          action={
            <Button type="button" size="sm" asChild>
              <Link href={retryHref}>Retry</Link>
            </Button>
          }
        />
      </DashboardPageScaffold>
    );
  }

  return <StoreDashboardShell data={data} />;
}
