import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const bundle = await getOwnedStoreBundle(user.id);
  const store = bundle?.store;

  if (!store) {
    return null;
  }

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id,title,description,sku,image_urls,is_featured,price_cents,inventory_qty,status,created_at")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  if (productsError) {
    throw new Error(productsError.message);
  }

  const { data: recentOrders, error: ordersError } = await supabase
    .from("orders")
    .select("id,total_cents,status,fulfillment_status,shipment_status,tracking_number,discount_cents,created_at")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (ordersError) {
    throw new Error(ordersError.message);
  }

  return (
    <DashboardOverview
      store={store}
      products={products ?? []}
      recentOrders={recentOrders ?? []}
    />
  );
}
