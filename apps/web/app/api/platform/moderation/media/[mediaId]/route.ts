import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({
  mediaId: z.string().uuid()
});

const bodySchema = z.object({
  action: z.enum(["hide", "remove", "restore"]),
  reason: z.string().trim().max(500).optional()
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ mediaId: string }> }) {
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
    return NextResponse.json({ error: "Invalid media id" }, { status: 400 });
  }

  const payload = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: media, error: mediaError } = await admin
    .from("review_media")
    .select("id,review_id,status,metadata,reviews!inner(store_id)")
    .eq("id", params.data.mediaId)
    .maybeSingle<{
      id: string;
      review_id: string;
      status: "active" | "hidden" | "removed";
      metadata: Record<string, unknown> | null;
      reviews: { store_id: string } | { store_id: string }[] | null;
    }>();

  if (mediaError) {
    return NextResponse.json({ error: mediaError.message }, { status: 500 });
  }
  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const reviewRelation = Array.isArray(media.reviews) ? media.reviews[0] ?? null : media.reviews;
  const storeId = reviewRelation?.store_id ?? null;
  const nextStatus = payload.data.action === "hide" ? "hidden" : payload.data.action === "remove" ? "removed" : "active";

  const { data: updated, error: updateError } = await admin
    .from("review_media")
    .update({
      status: nextStatus,
      moderation_reason: payload.data.reason ?? null,
      metadata: {
        ...(media.metadata ?? {}),
        moderation_source: "platform_admin",
        moderation_action: payload.data.action,
        moderation_actor_user_id: auth.context?.userId ?? null,
        moderation_reason: payload.data.reason ?? null,
        moderation_at: new Date().toISOString()
      }
    })
    .eq("id", media.id)
    .select("id,review_id,status,moderation_reason,updated_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId,
    actorUserId: auth.context?.userId ?? null,
    action: "update",
    entity: "review_media",
    entityId: media.id,
    metadata: {
      fromStatus: media.status,
      toStatus: nextStatus,
      moderationSource: "platform_admin",
      moderationReason: payload.data.reason ?? null
    }
  });

  return NextResponse.json({ media: updated, ok: true });
}
