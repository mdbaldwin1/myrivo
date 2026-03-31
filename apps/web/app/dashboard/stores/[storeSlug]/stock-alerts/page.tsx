import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ storeSlug: string }>;
};

type AlertRow = {
  id: string;
  email: string;
  status: "pending" | "sent" | "cancelled";
  alert_count: number;
  requested_at: string;
  sent_at: string | null;
  products: { title: string; slug: string } | { title: string; slug: string }[] | null;
  product_variants: { title: string | null; inventory_qty: number; status: "active" | "archived" } | { title: string | null; inventory_qty: number; status: "active" | "archived" }[] | null;
};

export default async function StoreWorkspaceStockAlertsPage({ params }: PageProps) {
  const { storeSlug } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const bundle = await getOwnedStoreBundleForSlug(user.id, storeSlug, "staff");
  if (!bundle) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("back_in_stock_alerts")
    .select("id,email,status,alert_count,requested_at,sent_at,products(title,slug),product_variants(title,inventory_qty,status)")
    .eq("store_id", bundle.store.id)
    .order("requested_at", { ascending: false })
    .returns<AlertRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const alerts = data ?? [];
  const pendingAlerts = alerts.filter((alert) => alert.status === "pending");
  const pendingByVariant = new Map<string, { productTitle: string; variantTitle: string; waiting: number; inventoryQty: number }>();

  for (const alert of pendingAlerts) {
    const product = Array.isArray(alert.products) ? alert.products[0] : alert.products;
    const variant = Array.isArray(alert.product_variants) ? alert.product_variants[0] : alert.product_variants;
    const key = `${product?.title ?? "product"}::${variant?.title ?? "default"}`;
    const current = pendingByVariant.get(key);
    pendingByVariant.set(key, {
      productTitle: product?.title ?? "Product",
      variantTitle: variant?.title ?? "Default variant",
      waiting: (current?.waiting ?? 0) + 1,
      inventoryQty: variant?.inventory_qty ?? 0
    });
  }

  const groupedWaiting = [...pendingByVariant.values()].sort((left, right) => right.waiting - left.waiting);

  return (
    <section className="space-y-4 p-3">
      <DashboardPageHeader
        title="Stock Alerts"
        description="See which out-of-stock variants customers are waiting on and which alerts have already been sent."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Pending alerts</p>
          <p className="mt-2 text-3xl font-semibold">{pendingAlerts.length}</p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Variants with waitlists</p>
          <p className="mt-2 text-3xl font-semibold">{groupedWaiting.length}</p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Alerts already sent</p>
          <p className="mt-2 text-3xl font-semibold">{alerts.filter((alert) => alert.status === "sent").length}</p>
        </article>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">What shoppers are waiting on</h2>
        {groupedWaiting.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No pending stock alerts yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="pb-2">Product</th>
                  <th className="pb-2">Variant</th>
                  <th className="pb-2">Waiting</th>
                  <th className="pb-2">Current stock</th>
                </tr>
              </thead>
              <tbody>
                {groupedWaiting.map((row) => (
                  <tr key={`${row.productTitle}-${row.variantTitle}`} className="border-t border-border">
                    <td className="py-2">{row.productTitle}</td>
                    <td className="py-2">{row.variantTitle}</td>
                    <td className="py-2">{row.waiting}</td>
                    <td className="py-2">{row.inventoryQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Recent alert requests</h2>
        {alerts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No alert requests yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Product</th>
                  <th className="pb-2">Variant</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Alerts sent</th>
                  <th className="pb-2">Requested</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => {
                  const product = Array.isArray(alert.products) ? alert.products[0] : alert.products;
                  const variant = Array.isArray(alert.product_variants) ? alert.product_variants[0] : alert.product_variants;
                  return (
                    <tr key={alert.id} className="border-t border-border">
                      <td className="py-2">{alert.email}</td>
                      <td className="py-2">{product?.title ?? "Product"}</td>
                      <td className="py-2">{variant?.title ?? "Default variant"}</td>
                      <td className="py-2 capitalize">{alert.status}</td>
                      <td className="py-2">{alert.alert_count}</td>
                      <td className="py-2">{new Date(alert.requested_at).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
