import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { requireAuthenticatedCustomerUser } from "@/lib/customer/account";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrderShippingDelayRecord } from "@/types/database";

const paramsSchema = z.object({
  orderId: z.string().uuid()
});

const payloadSchema = z.object({
  action: z.enum(["approve_delay", "request_cancellation"])
});

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }

  const payload = await parseJsonRequest(request, payloadSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireAuthenticatedCustomerUser(supabase);
  if (auth.response || !auth.user) {
    return auth.response!;
  }

  const normalizedEmail = (auth.user.email ?? "").trim().toLowerCase();
  if (!normalizedEmail) {
    return NextResponse.json({ error: "No customer email available for this account." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id,store_id,customer_email,fulfillment_method,fulfillment_status")
    .eq("id", parsedParams.data.orderId)
    .ilike("customer_email", normalizedEmail)
    .maybeSingle<{
      id: string;
      store_id: string;
      customer_email: string;
      fulfillment_method: "pickup" | "shipping" | null;
      fulfillment_status: string;
    }>();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.fulfillment_method !== "shipping") {
    return NextResponse.json({ error: "This order does not have an active shipping delay flow." }, { status: 400 });
  }

  const { data: activeDelay, error: delayError } = await admin
    .from("order_shipping_delays")
    .select("id,order_id,store_id,created_by_user_id,resolved_by_user_id,status,reason_key,customer_path,original_ship_promise,revised_ship_date,internal_note,resolution_note,metadata_json,resolved_at,created_at,updated_at")
    .eq("order_id", order.id)
    .eq("store_id", order.store_id)
    .is("resolved_at", null)
    .in("status", ["awaiting_customer_response", "refund_required"])
    .order("created_at", { ascending: false })
    .maybeSingle<OrderShippingDelayRecord>();

  if (delayError) {
    return NextResponse.json({ error: delayError.message }, { status: 500 });
  }

  if (!activeDelay) {
    return NextResponse.json({ error: "There is no active shipping delay waiting on your response." }, { status: 400 });
  }

  const nextStatus = payload.data.action === "approve_delay" ? "delay_approved" : "cancel_requested";
  const nextMetadata = {
    ...(activeDelay.metadata_json ?? {}),
    customerResponse: {
      action: payload.data.action,
      respondedAt: new Date().toISOString(),
      customerUserId: auth.user.id,
      customerEmail: normalizedEmail
    }
  };

  const { data: updatedDelay, error: updateError } = await admin
    .from("order_shipping_delays")
    .update({
      status: nextStatus,
      metadata_json: nextMetadata
    })
    .eq("id", activeDelay.id)
    .eq("store_id", order.store_id)
    .select("id,order_id,store_id,created_by_user_id,resolved_by_user_id,status,reason_key,customer_path,original_ship_promise,revised_ship_date,internal_note,resolution_note,metadata_json,resolved_at,created_at,updated_at")
    .single<OrderShippingDelayRecord>();

  if (updateError || !updatedDelay) {
    return NextResponse.json({ error: updateError?.message ?? "Unable to save your response." }, { status: 500 });
  }

  await logAuditEvent({
    storeId: order.store_id,
    actorUserId: auth.user.id,
    action: payload.data.action === "approve_delay" ? "shipping_delay_customer_approved" : "shipping_delay_customer_cancel_requested",
    entity: "order",
    entityId: order.id,
    metadata: {
      shippingDelayId: updatedDelay.id,
      previousStatus: activeDelay.status,
      nextStatus,
      customerPath: updatedDelay.customer_path,
      revisedShipDate: updatedDelay.revised_ship_date
    }
  });

  return NextResponse.json({ delay: updatedDelay });
}
