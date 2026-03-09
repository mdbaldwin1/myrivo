import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { notifyCustomerReviewModerated } from "@/lib/notifications/owner-notifications";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({
  reviewId: z.string().uuid()
});

const bodySchema = z.object({
  action: z.enum(["publish", "reject"]),
  reason: z.string().trim().max(500).optional()
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ reviewId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requirePlatformRole("support");
  if (auth.response) {
    return auth.response;
  }

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: "Invalid review id" }, { status: 400 });
  }

  const payload = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  if (payload.data.action === "reject" && !payload.data.reason) {
    return NextResponse.json({ error: "reason is required for reject action" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: review, error: reviewError } = await admin
    .from("reviews")
    .select("id,store_id,reviewer_user_id,status")
    .eq("id", params.data.reviewId)
    .maybeSingle<{ id: string; store_id: string; reviewer_user_id: string | null; status: "pending" | "published" | "rejected" }>();

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const nextStatus = payload.data.action === "publish" ? "published" : "rejected";
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from("reviews")
    .update({
      status: nextStatus,
      moderation_reason: payload.data.action === "reject" ? payload.data.reason ?? "rejected" : null,
      published_at: nextStatus === "published" ? now : null,
      metadata: {
        moderation_source: "platform_admin",
        moderation_action: payload.data.action,
        moderation_actor_user_id: auth.context?.userId ?? null,
        moderation_reason: payload.data.reason ?? null,
        moderation_at: now
      }
    })
    .eq("id", review.id)
    .select("id,store_id,status,moderation_reason,published_at,updated_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: review.store_id,
    actorUserId: auth.context?.userId ?? null,
    action: "update",
    entity: "review",
    entityId: review.id,
    metadata: {
      fromStatus: review.status,
      toStatus: nextStatus,
      moderationSource: "platform_admin",
      moderationReason: payload.data.reason ?? null
    }
  });

  if (review.reviewer_user_id) {
    await notifyCustomerReviewModerated({
      recipientUserId: review.reviewer_user_id,
      storeId: review.store_id,
      reviewId: review.id,
      status: nextStatus,
      reason: payload.data.reason ?? null
    }).catch(() => null);
  }

  return NextResponse.json({ review: updated, ok: true });
}
