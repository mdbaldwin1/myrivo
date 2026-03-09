import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { notifyCustomerReviewResponded } from "@/lib/notifications/owner-notifications";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle, getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  reviewId: z.string().uuid()
});

const putBodySchema = z.object({
  body: z.string().trim().min(1).max(2000),
  storeSlug: z.string().trim().min(1).max(120).optional()
});

const deleteBodySchema = z.object({
  storeSlug: z.string().trim().min(1).max(120).optional()
});

async function resolveBundle(userId: string, storeSlug: string | undefined) {
  if (storeSlug) {
    return getOwnedStoreBundleForSlug(userId, storeSlug, "staff");
  }

  return getOwnedStoreBundle(userId, "staff");
}

export async function PUT(request: NextRequest, context: { params: Promise<{ reviewId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: "Invalid review id" }, { status: 400 });
  }

  const payload = putBodySchema.safeParse(await request.json().catch(() => ({})));
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

  const bundle = await resolveBundle(user.id, payload.data.storeSlug);
  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("id,status,store_id,reviewer_user_id")
    .eq("id", params.data.reviewId)
    .eq("store_id", bundle.store.id)
    .maybeSingle<{ id: string; status: "pending" | "published" | "rejected"; store_id: string; reviewer_user_id: string | null }>();

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  if (review.status !== "published") {
    return NextResponse.json({ error: "Responses are only allowed for published reviews" }, { status: 409 });
  }

  const { data: response, error } = await supabase
    .from("review_responses")
    .upsert(
      {
        review_id: review.id,
        store_id: bundle.store.id,
        author_user_id: user.id,
        body: payload.data.body
      },
      { onConflict: "review_id" }
    )
    .select("id,review_id,store_id,author_user_id,body,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (review.reviewer_user_id) {
    await notifyCustomerReviewResponded({
      recipientUserId: review.reviewer_user_id,
      storeId: bundle.store.id,
      reviewId: review.id
    }).catch(() => null);
  }

  return NextResponse.json({ response });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ reviewId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: "Invalid review id" }, { status: 400 });
  }

  const payload = deleteBodySchema.safeParse(await request.json().catch(() => ({})));
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

  const bundle = await resolveBundle(user.id, payload.data.storeSlug);
  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const { error } = await supabase
    .from("review_responses")
    .delete()
    .eq("review_id", params.data.reviewId)
    .eq("store_id", bundle.store.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
