import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle, getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  reviewId: z.string().uuid(),
  mediaId: z.string().uuid()
});

const bodySchema = z.object({
  action: z.enum(["hide", "remove", "restore"]),
  reason: z.string().trim().max(500).optional(),
  storeSlug: z.string().trim().min(1).max(120).optional()
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ reviewId: string; mediaId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: "Invalid review/media id" }, { status: 400 });
  }

  const payload = bodySchema.safeParse(await request.json().catch(() => ({})));
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

  const bundle = payload.data.storeSlug
    ? await getOwnedStoreBundleForSlug(user.id, payload.data.storeSlug, "staff")
    : await getOwnedStoreBundle(user.id, "staff");

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("id,store_id")
    .eq("id", params.data.reviewId)
    .eq("store_id", bundle.store.id)
    .maybeSingle();

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const nextStatus = payload.data.action === "hide" ? "hidden" : payload.data.action === "remove" ? "removed" : "active";

  const { data: media, error } = await supabase
    .from("review_media")
    .select("id,review_id,metadata")
    .eq("id", params.data.mediaId)
    .eq("review_id", params.data.reviewId)
    .maybeSingle<{ id: string; review_id: string; metadata: Record<string, unknown> | null }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!media) {
    return NextResponse.json({ error: "Review media not found" }, { status: 404 });
  }

  const { data: updatedMedia, error: updateError } = await supabase
    .from("review_media")
    .update({
      status: nextStatus,
      moderation_reason: payload.data.reason ?? null,
      metadata: {
        ...(media.metadata ?? {}),
        moderation_action: payload.data.action,
        moderation_actor_user_id: user.id,
        moderation_reason: payload.data.reason ?? null,
        moderation_at: new Date().toISOString()
      }
    })
    .eq("id", media.id)
    .eq("review_id", media.review_id)
    .select("id,review_id,status,moderation_reason,updated_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "review_media_moderation_updated",
    entity: "review_media",
    entityId: media.id,
    metadata: {
      reviewId: review.id,
      moderationAction: payload.data.action,
      moderationReason: payload.data.reason ?? null,
      nextStatus
    }
  });

  return NextResponse.json({ media: updatedMedia });
}
