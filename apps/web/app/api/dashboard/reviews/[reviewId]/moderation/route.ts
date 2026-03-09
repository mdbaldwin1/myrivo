import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { notifyCustomerReviewModerated } from "@/lib/notifications/owner-notifications";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle, getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  reviewId: z.string().uuid()
});

const bodySchema = z.object({
  action: z.enum(["publish", "reject", "restore"]),
  reason: z.string().trim().max(500).optional(),
  storeSlug: z.string().trim().min(1).max(120).optional()
});

const allowedTransitions: Record<string, Set<string>> = {
  pending: new Set(["publish", "reject"]),
  published: new Set(["reject"]),
  rejected: new Set(["publish", "restore"])
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ reviewId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
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
    return NextResponse.json({ error: "reason is required when rejecting a review" }, { status: 400 });
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

  const { data: existing, error: existingError } = await supabase
    .from("reviews")
    .select("id,status,store_id,reviewer_user_id,metadata")
    .eq("id", params.data.reviewId)
    .eq("store_id", bundle.store.id)
    .maybeSingle<{
      id: string;
      status: "pending" | "published" | "rejected";
      store_id: string;
      reviewer_user_id: string | null;
      metadata: Record<string, unknown> | null;
    }>();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  if (!allowedTransitions[existing.status]?.has(payload.data.action)) {
    return NextResponse.json({ error: "Invalid moderation transition" }, { status: 409 });
  }

  const nextStatus = payload.data.action === "reject" ? "rejected" : "published";
  const now = new Date().toISOString();

  const { data: review, error } = await supabase
    .from("reviews")
    .update({
      status: nextStatus,
      moderation_reason: payload.data.action === "reject" ? payload.data.reason ?? "rejected" : null,
      published_at: nextStatus === "published" ? now : null,
      metadata: {
        ...(existing.metadata ?? {}),
        moderation_action: payload.data.action,
        moderation_actor_user_id: user.id,
        moderation_reason: payload.data.reason ?? null,
        moderation_at: now
      }
    })
    .eq("id", existing.id)
    .eq("store_id", bundle.store.id)
    .select("id,store_id,product_id,review_type,status,moderation_reason,published_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existing.reviewer_user_id) {
    await notifyCustomerReviewModerated({
      recipientUserId: existing.reviewer_user_id,
      storeId: bundle.store.id,
      reviewId: existing.id,
      status: nextStatus,
      reason: payload.data.reason ?? null
    }).catch(() => null);
  }

  return NextResponse.json({ review });
}
