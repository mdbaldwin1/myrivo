import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import type { OrderShippingDelayRecord } from "@/types/database";

const paramsSchema = z.object({
  delayId: z.string().uuid()
});

const payloadSchema = z.object({
  action: z.enum(["set_status", "resolve"]),
  status: z
    .enum([
      "delay_detected",
      "customer_contact_required",
      "awaiting_customer_response",
      "delay_approved",
      "delay_rejected",
      "cancel_requested",
      "refund_required",
      "resolved",
    ])
    .optional(),
  resolutionNote: z.string().trim().max(1000).optional(),
});

type RouteContext = {
  params: Promise<{ delayId: string }>;
};

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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: "Invalid shipping delay id." }, { status: 400 });
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

  const { data: delay, error: delayError } = await supabase
    .from("order_shipping_delays")
    .select("id,order_id,store_id,status")
    .eq("id", params.data.delayId)
    .eq("store_id", bundle.store.id)
    .maybeSingle<{ id: string; order_id: string; store_id: string; status: string }>();

  if (delayError) {
    return NextResponse.json({ error: delayError.message }, { status: 500 });
  }

  if (!delay) {
    return NextResponse.json({ error: "Shipping delay not found." }, { status: 404 });
  }

  const nextStatus = payload.data.action === "resolve" ? "resolved" : payload.data.status;
  if (!nextStatus) {
    return NextResponse.json({ error: "A next status is required." }, { status: 400 });
  }

  const isResolved = nextStatus === "resolved";
  const { data: updatedDelay, error: updateError } = await supabase
    .from("order_shipping_delays")
    .update({
      status: nextStatus,
      resolution_note: payload.data.resolutionNote?.trim() || null,
      resolved_at: isResolved ? new Date().toISOString() : null,
      resolved_by_user_id: isResolved ? user.id : null,
    })
    .eq("id", delay.id)
    .eq("store_id", bundle.store.id)
    .select("id,order_id,store_id,created_by_user_id,resolved_by_user_id,status,reason_key,customer_path,original_ship_promise,revised_ship_date,internal_note,resolution_note,metadata_json,resolved_at,created_at,updated_at")
    .single<OrderShippingDelayRecord>();

  if (updateError || !updatedDelay) {
    return NextResponse.json({ error: updateError?.message ?? "Unable to update shipping delay." }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: nextStatus === "resolved" ? "shipping_delay_resolved" : "shipping_delay_status_updated",
    entity: "order",
    entityId: delay.order_id,
    metadata: {
      shippingDelayId: delay.id,
      previousStatus: delay.status,
      nextStatus,
      resolutionNote: payload.data.resolutionNote?.trim() || null,
    }
  });

  return NextResponse.json({ delay: updatedDelay });
}
