import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { sendOrderShippingNotification } from "@/lib/notifications/order-emails";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { mapShipmentStatusToFulfillmentStatus, refreshTracker } from "@/lib/shipping/provider";
import { getStoreShippingConfig } from "@/lib/shipping/store-config";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const payloadSchema = z.object({
  orderId: z.string().uuid()
});

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = payloadSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundle(user.id);

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,carrier,tracking_number,shipment_tracker_id,shipment_status,fulfillment_status")
    .eq("id", payload.data.orderId)
    .eq("store_id", bundle.store.id)
    .maybeSingle<{
      id: string;
      carrier: string | null;
      tracking_number: string | null;
      shipment_tracker_id: string | null;
      shipment_status: string | null;
      fulfillment_status: string;
    }>();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!order.tracking_number) {
    return NextResponse.json({ error: "Order has no tracking number." }, { status: 400 });
  }

  const shippingConfig = await getStoreShippingConfig(supabase, bundle.store.id, true);

  const tracker = await refreshTracker({
    trackerId: order.shipment_tracker_id,
    carrier: order.carrier,
    trackingNumber: order.tracking_number
  }, shippingConfig);

  if (!tracker) {
    return NextResponse.json({
      order,
      synced: false,
      message: "Live tracking provider is not configured; saved tracking link is still available."
    });
  }

  const nextFulfillment = mapShipmentStatusToFulfillmentStatus(tracker.shipmentStatus);
  const now = new Date().toISOString();

  const { data: updatedOrder, error: updateError } = await supabase
    .from("orders")
    .update({
      shipment_status: tracker.shipmentStatus,
      tracking_url: tracker.trackingUrl,
      last_tracking_sync_at: now,
      fulfillment_status: nextFulfillment,
      delivered_at: nextFulfillment === "delivered" ? now : null
    })
    .eq("id", order.id)
    .eq("store_id", bundle.store.id)
    .select(
      "id,customer_email,subtotal_cents,total_cents,status,fulfillment_status,discount_cents,promo_code,carrier,tracking_number,tracking_url,shipment_status,created_at"
    )
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "sync_tracking",
    entity: "order",
    entityId: order.id,
    metadata: {
      shipmentStatus: tracker.shipmentStatus,
      fulfillmentStatus: nextFulfillment
    }
  });

  if (updatedOrder.fulfillment_status === "shipped" || updatedOrder.fulfillment_status === "delivered") {
    await sendOrderShippingNotification(updatedOrder.id, updatedOrder.fulfillment_status);
  }

  return NextResponse.json({ order: updatedOrder, synced: true });
}
