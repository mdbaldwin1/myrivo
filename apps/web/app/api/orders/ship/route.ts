import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { sendOrderShippingNotification } from "@/lib/notifications/order-emails";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { registerTracker, buildTrackingUrl } from "@/lib/shipping/provider";
import { getStoreShippingConfig } from "@/lib/shipping/store-config";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const payloadSchema = z.object({
  orderId: z.string().uuid(),
  carrier: z.string().trim().min(2).max(40),
  trackingNumber: z.string().trim().min(4).max(120)
});

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, payloadSchema);
  if (!payload.ok) {
    return payload.response;
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

  const { data: currentOrder, error: orderError } = await supabase
    .from("orders")
    .select("id,fulfillment_status")
    .eq("id", payload.data.orderId)
    .eq("store_id", bundle.store.id)
    .maybeSingle<{ id: string; fulfillment_status: string }>();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  if (!currentOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!["packing", "shipped", "delivered"].includes(currentOrder.fulfillment_status)) {
    return NextResponse.json(
      { error: "Order must be in packing status before shipment details can be saved." },
      { status: 400 }
    );
  }

  let tracker;
  try {
    const shippingConfig = await getStoreShippingConfig(supabase, bundle.store.id, true);
    tracker = await registerTracker({
      carrier: payload.data.carrier,
      trackingNumber: payload.data.trackingNumber
    }, shippingConfig);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const now = new Date().toISOString();
  const trackingUrl = tracker.trackingUrl ?? buildTrackingUrl(tracker.carrier, tracker.trackingNumber);

  const { data: order, error: updateError } = await supabase
    .from("orders")
    .update({
      carrier: tracker.carrier,
      tracking_number: tracker.trackingNumber,
      tracking_url: trackingUrl,
      shipment_provider: tracker.provider,
      shipment_tracker_id: tracker.trackerId,
      shipment_status: tracker.shipmentStatus,
      last_tracking_sync_at: now,
      shipped_at: now,
      fulfillment_status: currentOrder.fulfillment_status === "delivered" ? "delivered" : "shipped"
    })
    .eq("id", payload.data.orderId)
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
    action: "ship",
    entity: "order",
    entityId: payload.data.orderId,
    metadata: {
      carrier: tracker.carrier,
      trackingNumber: tracker.trackingNumber,
      trackerId: tracker.trackerId,
      shipmentStatus: tracker.shipmentStatus
    }
  });

  if (order.fulfillment_status === "shipped" || order.fulfillment_status === "delivered") {
    await sendOrderShippingNotification(order.id, order.fulfillment_status);
  }

  return NextResponse.json({ order });
}
