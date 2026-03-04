import { NextRequest, NextResponse } from "next/server";
import { getShippingEnv } from "@/lib/env";
import { sendOrderShippingNotification } from "@/lib/notifications/order-emails";
import { mapShipmentStatusToFulfillmentStatus, parseShippingWebhook } from "@/lib/shipping/provider";
import { getStoreIdsByWebhookSecret } from "@/lib/shipping/store-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function getWebhookSecret(request: NextRequest): string | null {
  const headerSecret = request.headers.get("x-shipping-webhook-secret");
  const querySecret = request.nextUrl.searchParams.get("token");

  return headerSecret ?? querySecret;
}

function isEnvAuthorizedWebhook(secret: string | null): boolean {
  const { SHIPPING_WEBHOOK_SECRET } = getShippingEnv();

  if (!SHIPPING_WEBHOOK_SECRET) {
    return false;
  }

  return secret === SHIPPING_WEBHOOK_SECRET;
}

export async function POST(request: NextRequest) {
  const webhookSecret = getWebhookSecret(request);
  const supabase = createSupabaseAdminClient();
  const storeIdsBySecret = webhookSecret ? await getStoreIdsByWebhookSecret(supabase, webhookSecret) : [];
  const allowEnvFallback = isEnvAuthorizedWebhook(webhookSecret);

  if (!allowEnvFallback && storeIdsBySecret.length === 0) {
    return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as unknown;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const updates = parseShippingWebhook(body);

  if (updates.length === 0) {
    return NextResponse.json({ received: true, updated: 0 });
  }

  let updatedCount = 0;

  for (const update of updates) {
    if (!update.trackingNumber) {
      continue;
    }

    let orderId: string | null = null;

    if (update.trackerId) {
      const trackerQuery = supabase
        .from("orders")
        .select("id")
        .eq("shipment_tracker_id", update.trackerId);
      const { data: orderByTracker } = storeIdsBySecret.length
        ? await trackerQuery.in("store_id", storeIdsBySecret).maybeSingle<{ id: string }>()
        : await trackerQuery.maybeSingle<{ id: string }>();

      orderId = orderByTracker?.id ?? null;
    }

    if (!orderId) {
      const baseQuery = supabase
        .from("orders")
        .select("id")
        .eq("tracking_number", update.trackingNumber)
        .order("created_at", { ascending: false })
        .limit(1);
      const scopedQuery = storeIdsBySecret.length ? baseQuery.in("store_id", storeIdsBySecret) : baseQuery;

      const { data: orderByNumber } = update.carrier
        ? await scopedQuery.eq("carrier", update.carrier).maybeSingle<{ id: string }>()
        : await scopedQuery.maybeSingle<{ id: string }>();

      orderId = orderByNumber?.id ?? null;
    }

    if (!orderId) {
      continue;
    }

    const fulfillmentStatus = mapShipmentStatusToFulfillmentStatus(update.shipmentStatus);
    const deliveredAt = fulfillmentStatus === "delivered" ? update.occurredAt : null;

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        shipment_provider: update.provider,
        shipment_tracker_id: update.trackerId,
        shipment_status: update.shipmentStatus,
        tracking_url: update.trackingUrl,
        last_tracking_sync_at: update.occurredAt,
        fulfillment_status: fulfillmentStatus,
        delivered_at: deliveredAt
      })
      .eq("id", orderId);

    if (updateError) {
      console.error(`shipping webhook update failed for order ${orderId}: ${updateError.message}`);
      continue;
    }

    updatedCount += 1;

    await supabase.from("audit_events").insert({
      store_id: null,
      actor_user_id: null,
      action: "shipping_webhook_update",
      entity: "order",
      entity_id: orderId,
      metadata: {
        provider: update.provider,
        shipmentStatus: update.shipmentStatus,
        fulfillmentStatus,
        trackerId: update.trackerId,
        trackingNumber: update.trackingNumber,
        raw: update.raw
      }
    });

    if (fulfillmentStatus === "shipped" || fulfillmentStatus === "delivered") {
      await sendOrderShippingNotification(orderId, fulfillmentStatus);
    }
  }

  return NextResponse.json({ received: true, updated: updatedCount });
}
