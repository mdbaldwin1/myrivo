import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { sendOrderShippingNotification } from "@/lib/notifications/order-emails";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";

const updateSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["pending", "paid", "failed", "cancelled"]).optional(),
  fulfillmentStatus: z.enum(["pending_fulfillment", "packing", "shipped", "delivered"]).optional()
});

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
    .select(
      "id,customer_email,subtotal_cents,total_cents,status,fulfillment_status,discount_cents,promo_code,carrier,tracking_number,tracking_url,shipment_status,created_at"
    )
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false });

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

  const payload = updateSchema.safeParse(await request.json());

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

  const bundle = await getOwnedStoreBundle(user.id, "staff");

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  if (payload.data.status !== undefined) {
    updates.status = payload.data.status;
  }

  if (payload.data.fulfillmentStatus !== undefined) {
    const { data: currentOrder, error: currentOrderError } = await supabase
      .from("orders")
      .select("fulfillment_status")
      .eq("id", payload.data.orderId)
      .eq("store_id", bundle.store.id)
      .maybeSingle<{ fulfillment_status: "pending_fulfillment" | "packing" | "shipped" | "delivered" }>();

    if (currentOrderError) {
      return NextResponse.json({ error: currentOrderError.message }, { status: 500 });
    }

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

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", payload.data.orderId)
    .eq("store_id", bundle.store.id)
    .select(
      "id,customer_email,subtotal_cents,total_cents,status,fulfillment_status,discount_cents,promo_code,carrier,tracking_number,tracking_url,shipment_status,created_at"
    )
    .single();

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

  if (data.fulfillment_status === "shipped" || data.fulfillment_status === "delivered") {
    await sendOrderShippingNotification(data.id, data.fulfillment_status);
  }

  return NextResponse.json({ order: data });
}
