import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { queueMerchantDigitalDeliveryResend } from "@/lib/digital-products/delivery-email";
import { getServerEnv } from "@/lib/env";
import { recordDigitalProductEventBestEffort } from "@/lib/digital-products/telemetry";

const operationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rollout"), storeId: z.string().uuid(), enabled: z.boolean() }).strict(),
  z.object({ action: z.literal("requeue"), storeId: z.string().uuid(), orderId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("resend"), storeId: z.string().uuid(), orderId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("reconcile"), storeId: z.string().uuid(), orderId: z.string().uuid() }).strict(),
]);

type HealthRow = {
  issue_type: string;
  store_id: string;
  order_id: string;
  job_id: string | null;
  status: string;
  attempt_count: number;
  age_minutes: number;
};

export async function GET() {
  const auth = await requirePlatformRole("admin");
  if (auth.response) return auth.response;
  const { data, error } = await createSupabaseAdminClient().rpc("get_digital_delivery_health", { p_limit: 200 });
  if (error) return NextResponse.json({ error: "Digital delivery health is unavailable." }, { status: 500 });
  const issues = ((data ?? []) as HealthRow[]).map((row) => ({
    issueType: row.issue_type,
    storeId: row.store_id,
    orderId: row.order_id,
    jobId: row.job_id,
    status: row.status,
    attemptCount: row.attempt_count,
    ageMinutes: row.age_minutes,
  }));
  await Promise.all(issues.map((issue) => recordDigitalProductEventBestEffort(
    createSupabaseAdminClient(),
    {
      eventType: issue.issueType === "paid_delivery_pending_over_5m"
        ? "delivery_job_aged"
        : "reconciliation_mismatch",
      storeId: issue.storeId,
      orderId: issue.orderId,
      dimensions: issue.issueType === "paid_delivery_pending_over_5m"
        ? { ageBucket: issue.ageMinutes >= 30 ? "30m_plus" : "5m_to_30m" }
        : { issueType: issue.status },
    },
  )));
  return NextResponse.json({ issues });
}

export async function POST(request: NextRequest) {
  const originFailure = enforceTrustedOrigin(request);
  if (originFailure) return originFailure;
  const auth = await requirePlatformRole("admin");
  if (auth.response) return auth.response;
  const idempotencyKey = z.string().trim().min(8).max(200).safeParse(request.headers.get("idempotency-key"));
  if (!idempotencyKey.success) return NextResponse.json({ error: "A valid idempotency key is required." }, { status: 400 });
  const parsed = await parseJsonRequest(request, operationSchema);
  if (!parsed.ok) return parsed.response;
  const actorUserId = auth.context?.userId;
  if (!actorUserId) return NextResponse.json({ error: "Operator identity is unavailable." }, { status: 403 });
  const admin = createSupabaseAdminClient();
  if (parsed.data.action === "resend") {
    const tokenSecret = getServerEnv().DIGITAL_DELIVERY_TOKEN_SECRET?.trim();
    if (!tokenSecret) return NextResponse.json({ error: "Digital delivery configuration is unavailable." }, { status: 503 });
    const result = await queueMerchantDigitalDeliveryResend({
      orderId: parsed.data.orderId,
      storeId: parsed.data.storeId,
      actorUserId,
      idempotencyKey: idempotencyKey.data,
      tokenSecret,
      client: admin,
    });
    if (!result.ok) return NextResponse.json({ error: "Digital delivery is not eligible for resend." }, { status: 409 });
    return NextResponse.json({ ok: true, result: result.status, duplicate: result.duplicate });
  }
  const rpcName = parsed.data.action === "rollout"
    ? "set_store_digital_products_enabled"
    : parsed.data.action === "requeue"
      ? "requeue_digital_delivery"
      : "reconcile_digital_order_access";
  const args = parsed.data.action === "rollout"
    ? { p_store_id: parsed.data.storeId, p_enabled: parsed.data.enabled, p_actor_user_id: actorUserId, p_idempotency_key: idempotencyKey.data }
    : { p_store_id: parsed.data.storeId, p_order_id: parsed.data.orderId, p_actor_user_id: actorUserId, p_idempotency_key: idempotencyKey.data };
  const { data, error } = await admin.rpc(rpcName, args);
  if (error) return NextResponse.json({ error: "Digital product operation failed." }, { status: 409 });
  return NextResponse.json({ ok: true, result: data });
}
