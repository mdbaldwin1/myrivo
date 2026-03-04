import { AuditEventsPanel } from "@/components/dashboard/audit-events-panel";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { isMissingRelationInSchemaCache } from "@/lib/supabase/error-classifiers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardInsightsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const bundle = await getOwnedStoreBundle(user.id);

  if (!bundle) {
    return null;
  }

  const [{ data: orders, error: ordersError }, { data: products, error: productsError }, { data: auditEvents, error: auditEventsError }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id,total_cents,status,fulfillment_status,shipment_status,tracking_number,discount_cents,created_at")
        .eq("store_id", bundle.store.id)
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("products")
        .select("id,title,inventory_qty,status")
        .eq("store_id", bundle.store.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("audit_events")
        .select("id,action,entity,entity_id,metadata,created_at")
        .eq("store_id", bundle.store.id)
        .order("created_at", { ascending: false })
        .limit(30)
    ]);

  if (ordersError) {
    throw new Error(ordersError.message);
  }

  if (productsError) {
    throw new Error(productsError.message);
  }

  if (auditEventsError && !isMissingRelationInSchemaCache(auditEventsError)) {
    throw new Error(auditEventsError.message);
  }

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title="Insights"
        description="Detailed trends and audit history beyond the Overview snapshot."
      />
      <InsightsPanel recentOrders={orders ?? []} products={products ?? []} />
      <AuditEventsPanel initialEvents={auditEvents ?? []} />
    </div>
  );
}
