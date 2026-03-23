import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/http/api-response";
import { isReviewsEnabledForStoreSlug } from "@/lib/reviews/feature-gating";
import { buildReviewSummary, decodeCursor, listPublishedReviews } from "@/lib/reviews/read";
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
  productId: z.string().uuid()
});

export async function GET(request: NextRequest, context: { params: Promise<{ productId: string }> }) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return fail(400, "Invalid product id.");
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

  const admin = createSupabaseAdminClient();
  const { data: product, error: productError } = await admin
    .from("products")
    .select("id,store_id")
    .eq("id", params.data.productId)
    .maybeSingle<{ id: string; store_id: string }>();

  if (productError) {
    return fail(500, productError.message);
  }

  if (!product) {
    return fail(404, "Product not found.");
  }
  const { data: store, error: storeError } = await admin.from("stores").select("slug").eq("id", product.store_id).maybeSingle<{ slug: string }>();
  if (storeError) {
    return fail(500, storeError.message);
  }
  if (!store?.slug) {
    return fail(404, "Store not found.");
  }
  if (!isReviewsEnabledForStoreSlug(store.slug)) {
    return fail(404, "Reviews are not enabled for this store.");
  }

  const query = parsedQuery.data;
  const offset = decodeCursor(query.cursor);

  try {
    const [listing, summary] = await Promise.all([
      listPublishedReviews(admin, {
        storeId: product.store_id,
        productId: product.id,
        rating: query.rating,
        verifiedOnly: query.verifiedOnly,
        hasMedia: query.hasMedia,
        sort: query.sort,
        limit: query.limit,
        offset
      }),
      buildReviewSummary(admin, {
        storeId: product.store_id,
        productId: product.id,
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
    return fail(500, error instanceof Error ? error.message : "Unable to load product reviews.");
  }
}
