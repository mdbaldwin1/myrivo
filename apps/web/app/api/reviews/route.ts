import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/http/api-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import {
  buildReviewMediaPublicUrl,
  deleteReviewMediaObjects,
  ensureReviewMediaBucket,
  isReviewMediaPathForStoreDraft,
  resolveActiveStoreBySlug,
  resolveReviewMediaLimits,
  sortAndReindexDraftReviewMediaAssets,
  validateReviewMediaDimensions,
  REVIEW_MEDIA_ALLOWED_MIME
} from "@/lib/reviews/media";
import {
  enforceReviewSubmissionRateLimits,
  evaluateReviewForModeration,
  getRequestIpAddress,
  hashReviewSignal,
  normalizeReviewText
} from "@/lib/reviews/abuse";
import { buildReviewComplianceMetadata, sanitizeReviewIncentiveDescription } from "@/lib/reviews/compliance";
import { isReviewsEnabledForStoreSlug } from "@/lib/reviews/feature-gating";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { notifyOwnersReviewCreated } from "@/lib/notifications/owner-notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reviewMediaSchema = z.object({
  storagePath: z.string().trim().min(1).max(1024),
  sortOrder: z.number().int().min(0).max(100).optional(),
  mimeType: z.string().trim().min(1).optional(),
  sizeBytes: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

const bodySchema = z
  .object({
    storeSlug: z.string().trim().min(1).max(120),
    reviewType: z.enum(["store", "product"]),
    productId: z.string().uuid().optional().nullable(),
    orderId: z.string().uuid().optional().nullable(),
    reviewDraftId: z.string().trim().min(1).max(64).optional(),
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(120).optional(),
    body: z.string().trim().max(5000).optional(),
    reviewerName: z.string().trim().max(120).optional(),
    reviewerEmail: z.string().trim().email().max(320),
    incentivized: z.boolean().optional().default(false),
    incentiveDescription: z.string().trim().max(160).optional(),
    media: z.array(reviewMediaSchema).max(20).optional().default([])
  })
  .superRefine((value, ctx) => {
    if (value.reviewType === "product" && !value.productId) {
      ctx.addIssue({ code: "custom", message: "productId is required for product reviews", path: ["productId"] });
    }
    if (value.reviewType === "store" && value.productId) {
      ctx.addIssue({ code: "custom", message: "productId must be empty for store reviews", path: ["productId"] });
    }
    if (value.media.length > 0 && !value.reviewDraftId) {
      ctx.addIssue({ code: "custom", message: "reviewDraftId is required when media is attached", path: ["reviewDraftId"] });
    }
    if (value.incentivized && !sanitizeReviewIncentiveDescription(value.incentiveDescription)) {
      ctx.addIssue({
        code: "custom",
        message: "Describe the incentive so the review can be disclosed correctly.",
        path: ["incentiveDescription"]
      });
    }
  });

function sanitizeOptionalText(value: string | undefined) {
  const normalized = value?.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return normalized ? normalized : null;
}

async function resolveVerifiedPurchase(input: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  storeId: string;
  reviewerEmail: string;
  productId: string | null;
  orderId: string | null;
}): Promise<{ verifiedPurchase: boolean; matchedOrderId: string | null }> {
  const normalizedEmail = normalizeReviewText(input.reviewerEmail);

  const verifyOrderContainsProduct = async (orderId: string) => {
    if (!input.productId) {
      return true;
    }

    const { data: orderItem, error: itemError } = await input.admin
      .from("order_items")
      .select("id")
      .eq("order_id", orderId)
      .eq("product_id", input.productId)
      .limit(1)
      .maybeSingle();

    if (itemError) {
      throw new Error(itemError.message);
    }

    return Boolean(orderItem?.id);
  };

  if (input.orderId) {
    const { data: order, error: orderError } = await input.admin
      .from("orders")
      .select("id")
      .eq("id", input.orderId)
      .eq("store_id", input.storeId)
      .eq("status", "paid")
      .eq("customer_email", normalizedEmail)
      .maybeSingle();

    if (orderError) {
      throw new Error(orderError.message);
    }

    if (!order?.id) {
      return { verifiedPurchase: false, matchedOrderId: null };
    }

    if (!(await verifyOrderContainsProduct(order.id))) {
      return { verifiedPurchase: false, matchedOrderId: null };
    }

    return { verifiedPurchase: true, matchedOrderId: order.id };
  }

  const { data: orders, error: ordersError } = await input.admin
    .from("orders")
    .select("id")
    .eq("store_id", input.storeId)
    .eq("status", "paid")
    .eq("customer_email", normalizedEmail)
    .order("created_at", { ascending: false })
    .limit(25);

  if (ordersError) {
    throw new Error(ordersError.message);
  }

  const orderIds = (orders ?? []).map((order) => order.id).filter(Boolean);
  if (orderIds.length === 0) {
    return { verifiedPurchase: false, matchedOrderId: null };
  }

  if (!input.productId) {
    return { verifiedPurchase: true, matchedOrderId: orderIds[0] ?? null };
  }

  const { data: productItem, error: productItemError } = await input.admin
    .from("order_items")
    .select("order_id")
    .eq("product_id", input.productId)
    .in("order_id", orderIds)
    .limit(1)
    .maybeSingle();

  if (productItemError) {
    throw new Error(productItemError.message);
  }

  if (!productItem?.order_id) {
    return { verifiedPurchase: false, matchedOrderId: null };
  }

  return { verifiedPurchase: true, matchedOrderId: productItem.order_id };
}

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const parsed = await parseJsonRequest(request, bodySchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const payload = parsed.data;
  if (!isReviewsEnabledForStoreSlug(payload.storeSlug)) {
    return fail(404, "Reviews are not enabled for this store.");
  }

  const store = await resolveActiveStoreBySlug(payload.storeSlug);
  if (!store) {
    return fail(404, "Store not found.");
  }

  const admin = createSupabaseAdminClient();

  if (payload.productId) {
    const { data: product, error: productError } = await admin
      .from("products")
      .select("id")
      .eq("id", payload.productId)
      .eq("store_id", store.id)
      .maybeSingle();

    if (productError) {
      return fail(500, productError.message);
    }

    if (!product?.id) {
      return fail(404, "Product not found for store.");
    }
  }

  const ipAddress = getRequestIpAddress(request.headers);
  const ipHash = hashReviewSignal(ipAddress);

  try {
    const rateLimit = await enforceReviewSubmissionRateLimits({
      admin,
      storeId: store.id,
      reviewerEmail: payload.reviewerEmail,
      ipHash
    });

    if (!rateLimit.ok) {
      return fail(429, "Review submission rate limit exceeded.", {
        code: rateLimit.code,
        retryAfterSeconds: rateLimit.retryAfterSeconds
      });
    }
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Unable to evaluate review rate limits.");
  }

  const abuseEvaluation = evaluateReviewForModeration({
    storeId: store.id,
    productId: payload.productId,
    reviewerEmail: payload.reviewerEmail,
    reviewerName: payload.reviewerName,
    title: payload.title,
    body: payload.body,
    ipAddress
  });

  const duplicateQuery = admin
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id)
    .eq("reviewer_email", abuseEvaluation.normalizedEmail)
    .contains("metadata", { fingerprint: abuseEvaluation.fingerprint });

  const duplicateScopedQuery = payload.productId
    ? duplicateQuery.eq("product_id", payload.productId)
    : duplicateQuery.is("product_id", null);

  const { count: duplicateCount, error: duplicateError } = await duplicateScopedQuery.gte(
    "created_at",
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  );

  if (duplicateError) {
    return fail(500, duplicateError.message);
  }

  if ((duplicateCount ?? 0) > 0) {
    return fail(409, "Duplicate review submission detected.", { code: "REVIEWS_DUPLICATE_SUBMISSION" });
  }

  const reviewerName = sanitizeOptionalText(payload.reviewerName);
  const title = sanitizeOptionalText(payload.title);
  const body = sanitizeOptionalText(payload.body);

  let mediaRows:
    | Array<{
        storage_path: string;
        public_url: string;
        sort_order: number;
        mime_type: string;
        size_bytes: number;
        width: number | null;
        height: number | null;
      }>
    | null = null;

  if (payload.media.length > 0) {
    try {
      await ensureReviewMediaBucket();
    } catch (error) {
      return fail(500, error instanceof Error ? error.message : "Unable to initialize review media bucket.");
    }

    const limits = resolveReviewMediaLimits();
    if (payload.media.length > limits.maxImagesPerReview) {
      return fail(400, `Maximum ${limits.maxImagesPerReview} images allowed per review.`);
    }

    for (const media of payload.media) {
      if (!isReviewMediaPathForStoreDraft(media.storagePath, store.id, payload.reviewDraftId ?? "")) {
        return fail(400, "Invalid media storage path for draft.");
      }
      if (media.mimeType && !REVIEW_MEDIA_ALLOWED_MIME.has(media.mimeType)) {
        return fail(400, "Unsupported media type.");
      }
      if (media.sizeBytes && media.sizeBytes > limits.maxFileSizeBytes) {
        return fail(400, `Image must be ${limits.maxFileSizeBytes} bytes or smaller.`);
      }

      const dimensionsCheck = validateReviewMediaDimensions(
        { width: media.width, height: media.height },
        { maxImageWidth: limits.maxImageWidth, maxImageHeight: limits.maxImageHeight }
      );
      if (!dimensionsCheck.ok) {
        return fail(400, dimensionsCheck.error);
      }
    }

    const normalizedMedia = sortAndReindexDraftReviewMediaAssets(
      payload.media.map((media, index) => ({
        storagePath: media.storagePath,
        publicUrl: buildReviewMediaPublicUrl(media.storagePath),
        sortOrder: media.sortOrder ?? index,
        mimeType: media.mimeType ?? "image/jpeg",
        sizeBytes: media.sizeBytes ?? 0
      })),
      limits.maxImagesPerReview
    );

    mediaRows = normalizedMedia.map((media, index) => ({
      storage_path: media.storagePath,
      public_url: media.publicUrl,
      sort_order: index,
      mime_type: media.mimeType ?? "image/jpeg",
      size_bytes: media.sizeBytes && media.sizeBytes > 0 ? media.sizeBytes : 1,
      width: payload.media[index]?.width ?? null,
      height: payload.media[index]?.height ?? null
    }));
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let verifiedPurchase = false;
  let matchedOrderId: string | null = null;
  try {
    const verification = await resolveVerifiedPurchase({
      admin,
      storeId: store.id,
      reviewerEmail: payload.reviewerEmail,
      productId: payload.productId ?? null,
      orderId: payload.orderId ?? null
    });
    verifiedPurchase = verification.verifiedPurchase;
    matchedOrderId = verification.matchedOrderId;
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Unable to verify purchase state.");
  }

  const metadata = buildReviewComplianceMetadata(
    {
    fingerprint: abuseEvaluation.fingerprint,
    abuse_reasons: abuseEvaluation.reasons,
    ip_hash: ipHash,
    user_agent: request.headers.get("user-agent") ?? null,
    review_draft_id: payload.reviewDraftId ?? null,
    source: "storefront"
    },
    {
      incentivized: payload.incentivized,
      incentiveDescription: payload.incentiveDescription
    }
  );

  const moderationReason = abuseEvaluation.holdForModeration
    ? `abuse:${abuseEvaluation.reasons.join(",") || "flagged"}`
    : null;

  const { data: review, error: reviewError } = await admin
    .from("reviews")
    .insert({
      store_id: store.id,
      product_id: payload.productId ?? null,
      order_id: matchedOrderId ?? payload.orderId ?? null,
      review_type: payload.reviewType,
      reviewer_user_id: user?.id ?? null,
      reviewer_email: abuseEvaluation.normalizedEmail,
      reviewer_name: reviewerName,
      rating: payload.rating,
      title,
      body,
      verified_purchase: verifiedPurchase,
      status: "pending",
      moderation_reason: moderationReason,
      metadata
    })
    .select(
      "id,store_id,product_id,order_id,review_type,reviewer_user_id,reviewer_email,reviewer_name,rating,title,body,verified_purchase,status,moderation_reason,metadata,published_at,created_at,updated_at"
    )
    .single();

  if (reviewError || !review) {
    if (mediaRows && mediaRows.length > 0) {
      await deleteReviewMediaObjects(mediaRows.map((item) => item.storage_path)).catch(() => null);
    }
    const message = reviewError?.message?.includes("idx_reviews_submission_dedupe")
      ? "Duplicate review submission detected."
      : reviewError?.message ?? "Unable to create review.";
    const code = reviewError?.message?.includes("idx_reviews_submission_dedupe")
      ? "REVIEWS_DUPLICATE_SUBMISSION"
      : "REVIEWS_CREATE_FAILED";
    return fail(409, message, { code });
  }

  if (mediaRows && mediaRows.length > 0) {
    const { data: insertedMedia, error: mediaError } = await admin
      .from("review_media")
      .insert(
        mediaRows.map((row) => ({
          review_id: review.id,
          storage_path: row.storage_path,
          public_url: row.public_url,
          mime_type: row.mime_type,
          size_bytes: row.size_bytes,
          width: row.width,
          height: row.height,
          sort_order: row.sort_order,
          status: "active"
        }))
      )
      .select("id,storage_path,public_url,mime_type,size_bytes,width,height,sort_order,status,created_at");

    if (mediaError) {
      await deleteReviewMediaObjects(mediaRows.map((item) => item.storage_path)).catch(() => null);
      await admin.from("reviews").delete().eq("id", review.id);
      return fail(500, mediaError.message, { code: "REVIEWS_MEDIA_PERSIST_FAILED" });
    }

    await notifyOwnersReviewCreated({
      storeId: store.id,
      storeSlug: payload.storeSlug,
      reviewId: review.id,
      productId: payload.productId ?? null,
      rating: review.rating,
      reviewerName: review.reviewer_name,
      holdForModeration: abuseEvaluation.holdForModeration
    }).catch(() => null);

    return ok(
      {
        review,
        media: (insertedMedia ?? []).sort((left, right) => left.sort_order - right.sort_order)
      },
      { status: 201 }
    );
  }

  await notifyOwnersReviewCreated({
    storeId: store.id,
    storeSlug: payload.storeSlug,
    reviewId: review.id,
    productId: payload.productId ?? null,
    rating: review.rating,
    reviewerName: review.reviewer_name,
    holdForModeration: abuseEvaluation.holdForModeration
  }).catch(() => null);

  return ok({ review, media: [] }, { status: 201 });
}
