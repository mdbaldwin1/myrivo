import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OrderDisputeRecord, OrderRefundRecord, OrderShippingDelayRecord } from "@/types/database";

const paramsSchema = z.object({
  orderId: z.string().uuid()
});

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const params = paramsSchema.safeParse(await context.params);

  if (!params.success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id,customer_email,customer_first_name,customer_last_name,customer_phone,subtotal_cents,total_cents,status,fulfillment_method,fulfillment_label,fulfillment_status,pickup_location_id,pickup_location_snapshot_json,pickup_window_start_at,pickup_window_end_at,pickup_timezone,fulfilled_at,shipped_at,delivered_at,discount_cents,promo_code,currency,carrier,tracking_number,tracking_url,shipment_status,last_tracking_sync_at,created_at,order_fee_breakdowns(platform_fee_cents,net_payout_cents,fee_bps,fee_fixed_cents,plan_key)"
    )
    .eq("id", params.data.orderId)
    .eq("store_id", bundle.store.id)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id,product_id,product_variant_id,variant_label,variant_snapshot,quantity,unit_price_cents,products(title)")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const admin = createSupabaseAdminClient();
  const { data: refunds, error: refundsError } = await admin
    .from("order_refunds")
    .select("id,order_id,store_id,requested_by_user_id,processed_by_user_id,amount_cents,reason_key,reason_note,customer_message,status,stripe_refund_id,metadata_json,processed_at,created_at,updated_at")
    .eq("order_id", order.id)
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false })
    .returns<OrderRefundRecord[]>();

  if (refundsError) {
    return NextResponse.json({ error: refundsError.message }, { status: 500 });
  }

  const { data: disputes, error: disputesError } = await admin
    .from("order_disputes")
    .select("id,order_id,store_id,stripe_dispute_id,stripe_charge_id,stripe_payment_intent_id,amount_cents,currency,reason,status,is_charge_refundable,response_due_by,metadata_json,closed_at,created_at,updated_at")
    .eq("order_id", order.id)
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false })
    .returns<OrderDisputeRecord[]>();

  if (disputesError) {
    return NextResponse.json({ error: disputesError.message }, { status: 500 });
  }

  const { data: shippingDelays, error: shippingDelaysError } = await admin
    .from("order_shipping_delays")
    .select("id,order_id,store_id,created_by_user_id,resolved_by_user_id,status,reason_key,customer_path,original_ship_promise,revised_ship_date,internal_note,resolution_note,metadata_json,resolved_at,created_at,updated_at")
    .eq("order_id", order.id)
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false })
    .returns<OrderShippingDelayRecord[]>();

  if (shippingDelaysError) {
    return NextResponse.json({ error: shippingDelaysError.message }, { status: 500 });
  }

  const { data: timelineEvents, error: timelineError } = await admin
    .from("audit_events")
    .select("id,actor_user_id,action,entity_id,metadata,created_at")
    .eq("entity", "order")
    .eq("entity_id", order.id)
    .in("action", [
      "shipping_delay_recorded",
      "shipping_delay_updated",
      "shipping_delay_status_updated",
      "shipping_delay_resolved",
      "shipping_delay_customer_approved",
      "shipping_delay_customer_cancel_requested"
    ])
    .order("created_at", { ascending: false })
    .returns<
      Array<{
        id: string;
        actor_user_id: string | null;
        action: string;
        entity_id: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
      }>
    >();

  if (timelineError) {
    return NextResponse.json({ error: timelineError.message }, { status: 500 });
  }

  return NextResponse.json({
    order,
    items: items ?? [],
    refunds: refunds ?? [],
    disputes: disputes ?? [],
    shippingDelays: shippingDelays ?? [],
    timelineEvents: timelineEvents ?? [],
  });
}
