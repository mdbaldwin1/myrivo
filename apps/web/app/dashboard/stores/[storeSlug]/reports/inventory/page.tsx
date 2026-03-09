import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { InventoryMovementsPanel } from "@/components/dashboard/inventory-movements-panel";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ storeSlug: string }> };

export default async function StoreWorkspaceReportsInventoryPage({ params }: PageProps) {
  const { storeSlug } = await params;
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

  return (
    <section className="space-y-4 p-4 lg:p-4">
      <DashboardPageHeader
        title="Inventory Ledger"
        description="Historical stock movements for audit, reconciliation, and support workflows."
      />
      <InventoryMovementsPanel />
    </section>
  );
}
