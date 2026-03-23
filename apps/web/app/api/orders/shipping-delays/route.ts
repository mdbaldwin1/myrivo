import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { sendOrderShippingDelayNotification } from "@/lib/notifications/order-emails";
import { getShippingDelayInitialStatus } from "@/lib/orders/shipping-delays";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import type { OrderShippingDelayRecord } from "@/types/database";

const payloadSchema = z.object({
  orderId: z.string().uuid(),
  reasonKey: z.enum([
    "inventory_shortfall",
    "supplier_delay",
    "production_delay",
    "carrier_disruption",
    "weather_or_emergency",
    "address_or_verification_issue",
    "fulfillment_capacity_issue",
    "other",
  ]),
  customerPath: z.enum(["notify_only", "request_delay_approval", "offer_cancel_or_refund"]),
  originalShipPromise: z.string().trim().max(160).optional(),
  revisedShipDate: z.string().date().optional(),
  internalNote: z.string().trim().max(1000).optional(),
});

async function requireOwnedBundle() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, bundle: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");
  if (!bundle) {
    return { supabase, user, bundle: null, response: NextResponse.json({ error: "No store found for account" }, { status: 404 }) };
  }

  return { supabase, user, bundle, response: null };
}

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, payloadSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const auth = await requireOwnedBundle();
  if (auth.response || !auth.bundle || !auth.user) {
    return auth.response!;
  }

  const { supabase, bundle, user } = auth;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,store_id,fulfillment_method,fulfillment_status")
    .eq("id", payload.data.orderId)
    .eq("store_id", bundle.store.id)
    .maybeSingle<{ id: string; store_id: string; fulfillment_method: "pickup" | "shipping" | null; fulfillment_status: string }>();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.fulfillment_method !== "shipping") {
    return NextResponse.json({ error: "Shipping delays only apply to shipping orders." }, { status: 400 });
  }

  if (order.fulfillment_status === "delivered") {
    return NextResponse.json({ error: "Delivered orders cannot be marked delayed." }, { status: 400 });
  }

  const { data: existingDelay, error: delayLookupError } = await supabase
    .from("order_shipping_delays")
    .select("id,status")
    .eq("order_id", order.id)
    .is("resolved_at", null)
    .neq("status", "resolved")
    .order("created_at", { ascending: false })
    .maybeSingle<{ id: string; status: string }>();

  if (delayLookupError) {
    return NextResponse.json({ error: delayLookupError.message }, { status: 500 });
  }

  const nextStatus = getShippingDelayInitialStatus(payload.data.customerPath);
  const delayPayload = {
    order_id: order.id,
    store_id: bundle.store.id,
    created_by_user_id: user.id,
    status: nextStatus,
    reason_key: payload.data.reasonKey,
    customer_path: payload.data.customerPath,
    original_ship_promise: payload.data.originalShipPromise?.trim() || null,
    revised_ship_date: payload.data.revisedShipDate ?? null,
    internal_note: payload.data.internalNote?.trim() || null,
    resolved_at: null,
    resolved_by_user_id: null,
    resolution_note: null,
  };

  const query = existingDelay
    ? supabase
        .from("order_shipping_delays")
        .update(delayPayload)
        .eq("id", existingDelay.id)
        .eq("store_id", bundle.store.id)
    : supabase.from("order_shipping_delays").insert(delayPayload);

  const { data: savedDelay, error: saveError } = await query
    .select("id,order_id,store_id,created_by_user_id,resolved_by_user_id,status,reason_key,customer_path,original_ship_promise,revised_ship_date,internal_note,resolution_note,metadata_json,resolved_at,created_at,updated_at")
    .single<OrderShippingDelayRecord>();

  if (saveError || !savedDelay) {
    return NextResponse.json({ error: saveError?.message ?? "Unable to save shipping delay." }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: existingDelay ? "shipping_delay_updated" : "shipping_delay_recorded",
    entity: "order",
    entityId: order.id,
    metadata: {
      shippingDelayId: savedDelay.id,
      status: savedDelay.status,
      reasonKey: savedDelay.reason_key,
      customerPath: savedDelay.customer_path,
      revisedShipDate: savedDelay.revised_ship_date,
    }
  });

  await sendOrderShippingDelayNotification(order.id, {
    delayId: savedDelay.id,
    reasonKey: savedDelay.reason_key,
    customerPath: savedDelay.customer_path,
    originalShipPromise: savedDelay.original_ship_promise,
    revisedShipDate: savedDelay.revised_ship_date
  });

  return NextResponse.json({ delay: savedDelay });
}
