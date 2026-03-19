import Link from "next/link";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { StoreDashboardShell } from "@/components/dashboard/store-dashboard/store-dashboard-shell";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { getStoreDashboardData } from "@/lib/dashboard/store-dashboard/get-store-dashboard-data";
import type { StoreDashboardPerformanceView } from "@/lib/dashboard/store-dashboard/store-dashboard-types";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type StoreWorkspacePageProps = {
  params: Promise<{ storeSlug: string }>;
  searchParams?: Promise<{ view?: string; month?: string; year?: string }>;
};

function normalizePerformanceView(rawView: string | undefined): StoreDashboardPerformanceView {
  if (rawView === "month" || rawView === "year") {
    return rawView;
  }
  return "month";
}

function normalizePerformanceMonth(rawMonth: string | undefined) {
  if (rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)) {
    return rawMonth;
  }
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function normalizePerformanceYear(rawYear: string | undefined) {
  const parsed = Number(rawYear);
  if (Number.isFinite(parsed) && parsed >= 2000 && parsed <= 3000) {
    return parsed;
  }
  return new Date().getUTCFullYear();
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

  const performanceView = normalizePerformanceView(resolvedSearchParams?.view);
  const performanceMonth = normalizePerformanceMonth(resolvedSearchParams?.month);
  const performanceYear = normalizePerformanceYear(resolvedSearchParams?.year);
  const retryParams = new URLSearchParams();
  retryParams.set("view", performanceView);
  retryParams.set("month", performanceMonth);
  retryParams.set("year", String(performanceYear));
  const retryHref = `/dashboard/stores/${activeStore.slug}?${retryParams.toString()}`;

  let data: Awaited<ReturnType<typeof getStoreDashboardData>> | null = null;
  let loadError: string | null = null;

  try {
    data = await getStoreDashboardData({
      supabase,
      store: activeStore,
      performanceView,
      performanceMonth,
      performanceYear
    });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load dashboard data.";
  }

  if (loadError || !data) {
    return (
      <DashboardPageScaffold title={`${activeStore.name} Control Tower`} description="Dashboard data is temporarily unavailable." className="p-3">
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
