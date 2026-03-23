import { OrdersManager } from "@/components/dashboard/orders-manager";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ storeSlug: string }> };

export default async function StoreWorkspaceOrdersPage({ params }: PageProps) {
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

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id,customer_email,subtotal_cents,total_cents,status,fulfillment_method,fulfillment_label,fulfillment_status,pickup_location_id,pickup_window_start_at,pickup_window_end_at,pickup_timezone,discount_cents,promo_code,carrier,tracking_number,tracking_url,shipment_status,created_at,order_fee_breakdowns(platform_fee_cents,net_payout_cents,fee_bps,fee_fixed_cents,plan_key)"
    )
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return <OrdersManager initialOrders={orders ?? []} />;
}
