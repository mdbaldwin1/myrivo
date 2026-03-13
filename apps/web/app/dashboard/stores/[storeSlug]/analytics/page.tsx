import Link from "next/link";
import { AuditEventsPanel } from "@/components/dashboard/audit-events-panel";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StorefrontAnalyticsEmptyState } from "@/components/dashboard/storefront-analytics-empty-state";
import { StorefrontAnalyticsFilterBar } from "@/components/dashboard/storefront-analytics-filter-bar";
import { StorefrontAnalyticsFunnelPanel } from "@/components/dashboard/storefront-analytics-funnel-panel";
import { StorefrontAnalyticsPanel } from "@/components/dashboard/storefront-analytics-panel";
import { StorefrontAnalyticsTrendPanel } from "@/components/dashboard/storefront-analytics-trend-panel";
import { StorefrontMerchandisingPanel } from "@/components/dashboard/storefront-merchandising-panel";
import { AppAlert } from "@/components/ui/app-alert";
import { buttonVariants } from "@/components/ui/button";
import { resolveStoreAnalyticsAccessByStoreId } from "@/lib/analytics/access";
import { getStorefrontMerchandisingSummary } from "@/lib/analytics/merchandising";
import { getStorefrontAnalyticsSummary, type StorefrontAnalyticsRange } from "@/lib/analytics/query";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissingRelationInSchemaCache } from "@/lib/supabase/error-classifiers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ storeSlug: string }>;
  searchParams?: Promise<{ range?: string; compare?: string }>;
};

function resolveRange(range: string | undefined): StorefrontAnalyticsRange {
  return range === "7d" || range === "90d" ? range : "30d";
}

export default async function StoreWorkspaceAnalyticsPage({ params, searchParams }: PageProps) {
  const { storeSlug } = await params;
  const filters = searchParams ? await searchParams : undefined;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const bundle = await getOwnedStoreBundleForSlug(user.id, storeSlug);
  if (!bundle) {
    return null;
  }

  const analyticsAccess = await resolveStoreAnalyticsAccessByStoreId(createSupabaseAdminClient(), bundle.store.id);

  const range = resolveRange(filters?.range);
  const compare = filters?.compare !== "0";

  if (!analyticsAccess.dashboardEnabled) {
    return (
      <div className="space-y-3 p-3">
        <DashboardPageHeader title="Analytics" description="Storefront traffic, funnel, merchandising, and engagement performance." />
        <AppAlert
          variant="info"
          title="Analytics isn’t available on this store yet"
          message="This store’s current plan or rollout settings do not include the owner analytics dashboard."
          action={
            <div className="pt-2">
              <Link
                href={`/dashboard/stores/${storeSlug}/store-settings/general`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
              >
                Open settings
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const [{ data: auditEvents, error: auditEventsError }, analyticsSummary, merchandisingSummary] = await Promise.all([
    supabase
      .from("audit_events")
      .select("id,action,entity,entity_id,metadata,created_at")
      .eq("store_id", bundle.store.id)
      .order("created_at", { ascending: false })
      .limit(30),
    getStorefrontAnalyticsSummary({
      supabase,
      storeId: bundle.store.id,
      range,
      compare
    }),
    getStorefrontMerchandisingSummary({
      supabase,
      storeId: bundle.store.id,
      range
    })
  ]);

  if (auditEventsError && !isMissingRelationInSchemaCache(auditEventsError)) {
    throw new Error(auditEventsError.message);
  }

  const hasTrafficData =
    analyticsSummary.current.sessions > 0 ||
    analyticsSummary.current.pageViews > 0 ||
    analyticsSummary.current.productViews > 0 ||
    analyticsSummary.current.paidOrders > 0;

  return (
    <div className="space-y-3 p-3">
      <DashboardPageHeader
        title="Analytics"
        description="Storefront traffic, funnel, merchandising, and engagement performance."
        action={<StorefrontAnalyticsFilterBar storeSlug={storeSlug} range={range} compare={compare} />}
      />
      {hasTrafficData ? (
        <>
          <StorefrontAnalyticsPanel summary={analyticsSummary} />
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <StorefrontAnalyticsTrendPanel summary={analyticsSummary} />
            <StorefrontAnalyticsFunnelPanel summary={analyticsSummary} />
          </div>
        </>
      ) : (
        <StorefrontAnalyticsEmptyState storeSlug={storeSlug} />
      )}
      <StorefrontMerchandisingPanel storeSlug={storeSlug} range={range} summary={merchandisingSummary} />
      <AuditEventsPanel initialEvents={auditEvents ?? []} />
    </div>
  );
}
