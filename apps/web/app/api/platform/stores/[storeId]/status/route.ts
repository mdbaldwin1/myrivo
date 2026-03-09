import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { notifyOwnersStoreStatusChanged } from "@/lib/notifications/owner-notifications";
import { STORE_GOVERNANCE_REASON_CODES } from "@/lib/platform/store-governance";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const payloadSchema = z.object({
  action: z.enum(["approve", "reject", "suspend"]),
  reasonCode: z.enum(STORE_GOVERNANCE_REASON_CODES).optional(),
  reason: z.string().trim().max(500).optional()
});

type StoreStatus = "draft" | "pending_review" | "active" | "suspended";

const nextStatusByAction: Record<z.infer<typeof payloadSchema>["action"], StoreStatus> = {
  approve: "active",
  reject: "draft",
  suspend: "suspended"
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requirePlatformRole("admin");
  if (auth.response) {
    return auth.response;
  }

  const payload = payloadSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const { storeId } = await params;
  const admin = createSupabaseAdminClient();
  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id,name,slug,status")
    .eq("id", storeId)
    .maybeSingle<{ id: string; name: string; slug: string; status: StoreStatus }>();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }
  if (!store) {
    return NextResponse.json({ error: "Store not found." }, { status: 404 });
  }

  if (payload.data.action === "approve" && store.status !== "pending_review") {
    return NextResponse.json({ error: "Only stores pending review can be approved." }, { status: 409 });
  }

  if (payload.data.action === "reject" && store.status !== "pending_review") {
    return NextResponse.json({ error: "Only stores pending review can be rejected." }, { status: 409 });
  }

  if ((payload.data.action === "reject" || payload.data.action === "suspend") && !payload.data.reasonCode) {
    return NextResponse.json({ error: "reasonCode is required for reject and suspend actions." }, { status: 400 });
  }

  const nextStatus = nextStatusByAction[payload.data.action];
  const normalizedReason = payload.data.reason?.trim() || null;
  const normalizedReasonCode = payload.data.reasonCode ?? null;
  const notifyReason =
    normalizedReason ||
    (normalizedReasonCode
      ? `reason_code:${normalizedReasonCode}`
      : null);

  const { data: updatedStore, error: updateError } = await admin
    .from("stores")
    .update({ status: nextStatus })
    .eq("id", store.id)
    .select("id,name,slug,status")
    .maybeSingle<{ id: string; name: string; slug: string; status: StoreStatus }>();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updatedStore) {
    return NextResponse.json({ error: "Unable to update store status." }, { status: 500 });
  }

  await logAuditEvent({
    storeId: store.id,
    actorUserId: auth.context?.userId ?? null,
    action: "update",
    entity: "store",
    entityId: store.id,
    metadata: {
      fromStatus: store.status,
      toStatus: nextStatus,
      reviewAction: payload.data.action,
      reviewReason: normalizedReason,
      reviewReasonCode: normalizedReasonCode,
      source: "platform_store_status"
    }
  });

  await Promise.allSettled([
    notifyOwnersStoreStatusChanged({
      storeId: store.id,
      storeSlug: store.slug,
      action: payload.data.action,
      reason: notifyReason,
      actorUserId: auth.context?.userId ?? undefined
    })
  ]);

  return NextResponse.json({ store: updatedStore, ok: true });
}
