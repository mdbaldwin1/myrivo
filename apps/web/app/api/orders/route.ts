import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { sendOrderPickupUpdatedNotification, sendOrderShippingNotification, sendOrderStatusNotification } from "@/lib/notifications/order-emails";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";

const updateSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["pending", "paid", "failed", "cancelled"]).optional(),
  fulfillmentStatus: z.enum(["pending_fulfillment", "packing", "shipped", "delivered"]).optional(),
  pickupWindowStartAt: z.string().nullable().optional(),
  pickupWindowEndAt: z.string().nullable().optional(),
  pickupTimezone: z.string().trim().nullable().optional()
});

const orderSelect =
  "id,customer_email,subtotal_cents,total_cents,status,fulfillment_method,fulfillment_label,fulfillment_status,pickup_location_id,pickup_window_start_at,pickup_window_end_at,pickup_timezone,discount_cents,promo_code,carrier,tracking_number,tracking_url,shipment_status,created_at,order_fee_breakdowns(platform_fee_cents,net_payout_cents,fee_bps,fee_fixed_cents,plan_key)";

type OrderFeeBreakdownRow = {
  platform_fee_cents: number;
  net_payout_cents: number;
  fee_bps: number;
  fee_fixed_cents: number;
  plan_key: string | null;
};

type OrderWithFeeBreakdown = {
  id: string;
  customer_email: string;
  subtotal_cents: number;
  total_cents: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  fulfillment_method: "pickup" | "shipping" | null;
  fulfillment_label: string | null;
  fulfillment_status: "pending_fulfillment" | "packing" | "shipped" | "delivered";
  pickup_location_id: string | null;
  pickup_window_start_at: string | null;
  pickup_window_end_at: string | null;
  pickup_timezone: string | null;
  discount_cents: number;
  promo_code: string | null;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipment_status: string | null;
  created_at: string;
  order_fee_breakdowns: OrderFeeBreakdownRow | OrderFeeBreakdownRow[] | null;
};

type CurrentOrderLifecycleRow = {
  status: "pending" | "paid" | "failed" | "cancelled";
  fulfillment_status: "pending_fulfillment" | "packing" | "shipped" | "delivered";
  fulfillment_method: "pickup" | "shipping" | null;
  pickup_window_start_at: string | null;
  pickup_window_end_at: string | null;
  pickup_timezone: string | null;
};

export async function GET() {
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

  const { data, error } = await supabase
    .from("orders")
    .select(orderSelect)
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false })
    .returns<OrderWithFeeBreakdown[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, updateSchema);
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

  const updates: Record<string, unknown> = {};
  const pickupFieldsProvided =
    payload.data.pickupWindowStartAt !== undefined || payload.data.pickupWindowEndAt !== undefined || payload.data.pickupTimezone !== undefined;
  let currentOrder: CurrentOrderLifecycleRow | null = null;

  if (payload.data.status !== undefined || payload.data.fulfillmentStatus !== undefined || pickupFieldsProvided) {
    const currentOrderResult = await supabase
      .from("orders")
      .select("status,fulfillment_status,fulfillment_method,pickup_window_start_at,pickup_window_end_at,pickup_timezone")
      .eq("id", payload.data.orderId)
      .eq("store_id", bundle.store.id)
      .maybeSingle<CurrentOrderLifecycleRow>();

    if (currentOrderResult.error) {
      return NextResponse.json({ error: currentOrderResult.error.message }, { status: 500 });
    }

    currentOrder = currentOrderResult.data;

    if (!currentOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
  }

  if (payload.data.status !== undefined) {
    updates.status = payload.data.status;
  }

  if (payload.data.fulfillmentStatus !== undefined) {
    if (!currentOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const transitions: Record<string, string[]> = {
      pending_fulfillment: ["packing", "shipped", "delivered"],
      packing: ["shipped", "delivered"],
      shipped: ["delivered"],
      delivered: []
    };

    if (!transitions[currentOrder.fulfillment_status]?.includes(payload.data.fulfillmentStatus)) {
      return NextResponse.json(
        { error: `Invalid fulfillment transition: ${currentOrder.fulfillment_status} -> ${payload.data.fulfillmentStatus}` },
        { status: 400 }
      );
    }

    updates.fulfillment_status = payload.data.fulfillmentStatus;
    if (payload.data.fulfillmentStatus === "delivered") {
      updates.delivered_at = new Date().toISOString();
      updates.fulfilled_at = new Date().toISOString();
    } else if (payload.data.fulfillmentStatus === "shipped") {
      updates.shipped_at = new Date().toISOString();
    }
  }

  if (pickupFieldsProvided) {
    if (!currentOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (currentOrder.fulfillment_method !== "pickup") {
      return NextResponse.json({ error: "Pickup details can only be updated for pickup orders." }, { status: 400 });
    }

    updates.pickup_window_start_at = payload.data.pickupWindowStartAt ?? currentOrder.pickup_window_start_at;
    updates.pickup_window_end_at = payload.data.pickupWindowEndAt ?? currentOrder.pickup_window_end_at;
    updates.pickup_timezone = payload.data.pickupTimezone ?? currentOrder.pickup_timezone;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", payload.data.orderId)
    .eq("store_id", bundle.store.id)
    .select(orderSelect)
    .single<OrderWithFeeBreakdown>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "update",
    entity: "order",
    entityId: payload.data.orderId,
    metadata: updates
  });

  if (payload.data.status !== undefined && currentOrder && currentOrder.status !== payload.data.status) {
    if (payload.data.status === "paid" || payload.data.status === "failed" || payload.data.status === "cancelled") {
      await sendOrderStatusNotification(data.id, payload.data.status);
    }
  }

  if (
    pickupFieldsProvided &&
    currentOrder &&
    (currentOrder.pickup_window_start_at !== (updates.pickup_window_start_at as string | null | undefined) ||
      currentOrder.pickup_window_end_at !== (updates.pickup_window_end_at as string | null | undefined) ||
      currentOrder.pickup_timezone !== (updates.pickup_timezone as string | null | undefined))
  ) {
    await sendOrderPickupUpdatedNotification(data.id);
  }

  if (data.fulfillment_status === "shipped" || data.fulfillment_status === "delivered") {
    await sendOrderShippingNotification(data.id, data.fulfillment_status);
  }

  return NextResponse.json({ order: data });
}
