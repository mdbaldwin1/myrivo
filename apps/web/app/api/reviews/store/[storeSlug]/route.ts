import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/http/api-response";
import { isReviewsEnabledForStoreSlug } from "@/lib/reviews/feature-gating";
import { buildReviewSummary, decodeCursor, listPublishedReviews } from "@/lib/reviews/read";
import { resolveActiveStoreBySlug } from "@/lib/reviews/media";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  verifiedOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  hasMedia: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  sort: z.enum(["newest", "highest", "lowest"]).default("newest"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional()
});

const paramsSchema = z.object({
  storeSlug: z.string().trim().min(1).max(120)
});

export async function GET(request: NextRequest, context: { params: Promise<{ storeSlug: string }> }) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return fail(400, "Invalid store slug.");
  }
  if (!isReviewsEnabledForStoreSlug(params.data.storeSlug)) {
    return fail(404, "Reviews are not enabled for this store.");
  }

  const parsedQuery = querySchema.safeParse({
    rating: request.nextUrl.searchParams.get("rating") ?? undefined,
    verifiedOnly: request.nextUrl.searchParams.get("verifiedOnly") ?? undefined,
    hasMedia: request.nextUrl.searchParams.get("hasMedia") ?? undefined,
    sort: request.nextUrl.searchParams.get("sort") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    cursor: request.nextUrl.searchParams.get("cursor") ?? undefined
  });

  if (!parsedQuery.success) {
    return fail(400, "Invalid query.", parsedQuery.error.flatten());
  }

  const store = await resolveActiveStoreBySlug(params.data.storeSlug);
  if (!store) {
    return fail(404, "Store not found.");
  }

  const admin = createSupabaseAdminClient();
  const query = parsedQuery.data;
  const offset = decodeCursor(query.cursor);

  try {
    const [listing, summary] = await Promise.all([
      listPublishedReviews(admin, {
        storeId: store.id,
        productId: null,
        rating: query.rating,
        verifiedOnly: query.verifiedOnly,
        hasMedia: query.hasMedia,
        sort: query.sort,
        limit: query.limit,
        offset
      }),
      buildReviewSummary(admin, {
        storeId: store.id,
        productId: null,
        verifiedOnly: query.verifiedOnly,
        hasMedia: query.hasMedia
      })
    ]);

    return ok({
      items: listing.items,
      nextCursor: listing.nextCursor,
      summary
    });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Unable to load store reviews.");
  }
}
