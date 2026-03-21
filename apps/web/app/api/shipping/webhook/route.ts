import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getShippingEnv } from "@/lib/env";
import { sendOrderShippingNotification } from "@/lib/notifications/order-emails";
import {
  mapShipmentStatusToFulfillmentStatus,
  parseShippingWebhook,
  resolveMonotonicFulfillmentStatus,
  resolveShippedAt
} from "@/lib/shipping/provider";
import { getStoreIdsByWebhookSecret } from "@/lib/shipping/store-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function getWebhookSecret(request: NextRequest): string | null {
  const headerSecret = request.headers.get("x-shipping-webhook-secret");
  if (headerSecret) {
    return headerSecret;
  }

  const allowQueryToken = (getShippingEnv().SHIPPING_ALLOW_QUERY_TOKEN ?? "").trim().toLowerCase();
  const queryEnabled = allowQueryToken === "true" || allowQueryToken === "1" || allowQueryToken === "yes";
  if (queryEnabled) {
    return request.nextUrl.searchParams.get("token");
  }

  return null;
}

function asEnabled(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function normalizeSignature(value: string | null) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("v1=")) {
    return trimmed.slice(3);
  }

  if (trimmed.startsWith("sha256=")) {
    return trimmed.slice(7);
  }

  return trimmed;
}

function constantTimeMatches(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyWebhookSignature(rawBody: string, request: NextRequest) {
  const env = getShippingEnv();
  const signatureSecret = env.SHIPPING_WEBHOOK_SIGNING_SECRET?.trim();
  const signatureRequired = asEnabled(env.SHIPPING_WEBHOOK_REQUIRE_SIGNATURE);

  if (!signatureSecret) {
    return { ok: !signatureRequired, reason: signatureRequired ? "Missing shipping webhook signing secret." : null };
  }

  const timestampHeader = request.headers.get("x-shipping-timestamp");
  const signatureHeader = normalizeSignature(request.headers.get("x-shipping-signature"));

  if (!timestampHeader || !signatureHeader) {
    return { ok: false, reason: "Missing webhook signature headers." };
  }

  const timestampSeconds = Number(timestampHeader);
  if (!Number.isFinite(timestampSeconds)) {
    return { ok: false, reason: "Invalid webhook timestamp." };
  }

  const toleranceSeconds = Math.max(10, Number(env.SHIPPING_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS ?? "300"));
  const nowSeconds = Date.now() / 1000;
  if (Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) {
    return { ok: false, reason: "Webhook timestamp outside tolerance window." };
  }

  const payload = `${timestampHeader}.${rawBody}`;
  const expected = createHmac("sha256", signatureSecret).update(payload).digest("hex");

  if (!constantTimeMatches(signatureHeader.toLowerCase(), expected.toLowerCase())) {
    return { ok: false, reason: "Invalid webhook signature." };
  }

  return { ok: true, reason: null };
}

export async function POST(request: NextRequest) {
  const webhookSecret = getWebhookSecret(request);
  const supabase = createSupabaseAdminClient();
  const storeIdsBySecret = webhookSecret ? await getStoreIdsByWebhookSecret(supabase, webhookSecret) : [];

  if (storeIdsBySecret.length === 0) {
    return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
  }

  const rawBody = await request.text().catch(() => "");
  if (!rawBody) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const signatureVerification = verifyWebhookSignature(rawBody, request);
  if (!signatureVerification.ok) {
    return NextResponse.json({ error: signatureVerification.reason ?? "Unauthorized webhook signature." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

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

    let order: {
      id: string;
      store_id: string;
      fulfillment_status: "pending_fulfillment" | "packing" | "shipped" | "delivered";
      delivered_at: string | null;
      shipped_at: string | null;
    } | null =
      null;

    if (update.trackerId) {
      const trackerQuery = supabase
        .from("orders")
        .select("id,store_id,fulfillment_status,delivered_at,shipped_at")
        .eq("shipment_tracker_id", update.trackerId);
      const { data: orderByTracker } = storeIdsBySecret.length
        ? await trackerQuery
            .in("store_id", storeIdsBySecret)
            .maybeSingle<{
              id: string;
              store_id: string;
              fulfillment_status: "pending_fulfillment" | "packing" | "shipped" | "delivered";
              delivered_at: string | null;
              shipped_at: string | null;
            }>()
        : await trackerQuery.maybeSingle<{
            id: string;
            store_id: string;
            fulfillment_status: "pending_fulfillment" | "packing" | "shipped" | "delivered";
            delivered_at: string | null;
            shipped_at: string | null;
          }>();

      order = orderByTracker ?? null;
    }

    if (!order) {
      const baseQuery = supabase
        .from("orders")
        .select("id,store_id,fulfillment_status,delivered_at,shipped_at")
        .eq("tracking_number", update.trackingNumber)
        .order("created_at", { ascending: false })
        .limit(1);
      const scopedQuery = storeIdsBySecret.length ? baseQuery.in("store_id", storeIdsBySecret) : baseQuery;

      const { data: orderByNumber } = update.carrier
        ? await scopedQuery
            .eq("carrier", update.carrier)
            .maybeSingle<{
              id: string;
              store_id: string;
              fulfillment_status: "pending_fulfillment" | "packing" | "shipped" | "delivered";
              delivered_at: string | null;
              shipped_at: string | null;
            }>()
        : await scopedQuery.maybeSingle<{
            id: string;
            store_id: string;
            fulfillment_status: "pending_fulfillment" | "packing" | "shipped" | "delivered";
            delivered_at: string | null;
            shipped_at: string | null;
          }>();

      order = orderByNumber ?? null;
    }

    if (!order) {
      continue;
    }

    const candidateStatus = mapShipmentStatusToFulfillmentStatus(update.shipmentStatus);
    const fulfillmentStatus = resolveMonotonicFulfillmentStatus(order.fulfillment_status, candidateStatus);
    const deliveredAt =
      fulfillmentStatus === "delivered"
        ? order.delivered_at ?? update.occurredAt
        : order.delivered_at;

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        shipment_provider: update.provider,
        shipment_tracker_id: update.trackerId,
        shipment_status: update.shipmentStatus,
        tracking_url: update.trackingUrl,
        last_tracking_sync_at: update.occurredAt,
        fulfillment_status: fulfillmentStatus,
        delivered_at: deliveredAt,
        shipped_at: resolveShippedAt(order.shipped_at, fulfillmentStatus, update.occurredAt)
      })
      .eq("id", order.id);

    if (updateError) {
      console.error(`shipping webhook update failed for order ${order.id}: ${updateError.message}`);
      continue;
    }

    updatedCount += 1;

    await supabase.from("audit_events").insert({
      store_id: order.store_id,
      actor_user_id: null,
      action: "shipping_webhook_update",
      entity: "order",
      entity_id: order.id,
      metadata: {
        provider: update.provider,
        shipmentStatus: update.shipmentStatus,
        candidateFulfillmentStatus: candidateStatus,
        previousFulfillmentStatus: order.fulfillment_status,
        resultingFulfillmentStatus: fulfillmentStatus,
        trackerId: update.trackerId,
        trackingNumber: update.trackingNumber,
        raw: update.raw
      }
    });

    if (fulfillmentStatus === "shipped" || fulfillmentStatus === "delivered") {
      await sendOrderShippingNotification(order.id, fulfillmentStatus);
    }
  }

  return NextResponse.json({ received: true, updated: updatedCount });
}
