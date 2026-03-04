import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { InventoryMovementsPanel } from "@/components/dashboard/inventory-movements-panel";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardReportsInventoryPage() {
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

  return (
    <section className="space-y-4">
      <DashboardPageHeader
        title="Reports · Inventory Ledger"
        description="Historical stock movements for audit, reconciliation, and support workflows."
      />
      <InventoryMovementsPanel />
    </section>
  );
}

