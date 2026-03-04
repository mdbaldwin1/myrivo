import { OrdersManager } from "@/components/dashboard/orders-manager";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardOrdersPage() {
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

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id,customer_email,subtotal_cents,total_cents,status,fulfillment_status,discount_cents,promo_code,carrier,tracking_number,tracking_url,shipment_status,created_at,order_fee_breakdowns(platform_fee_cents,net_payout_cents,fee_bps,fee_fixed_cents,plan_key)"
    )
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return <OrdersManager initialOrders={orders ?? []} />;
}
