import type { SupabaseClient } from "@supabase/supabase-js";
import { readReviewIncentiveDisclosure } from "@/lib/reviews/compliance";

export type ReviewSort = "newest" | "highest" | "lowest";

export type ReviewReadFilters = {
  storeId: string;
  productId?: string | null;
  rating?: number;
  verifiedOnly?: boolean;
  hasMedia?: boolean;
  sort: ReviewSort;
  limit: number;
  offset: number;
};

type MediaRow = {
  id: string;
  storage_path: string;
  public_url: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  sort_order: number;
  status: "active" | "hidden" | "removed";
  created_at: string;
};

type ResponseRow = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

type ReviewRow = {
  id: string;
  store_id: string;
  product_id: string | null;
  review_type: "store" | "product";
  reviewer_name: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  verified_purchase: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  published_at: string | null;
  review_media?: MediaRow[] | null;
  review_responses?: ResponseRow | ResponseRow[] | null;
};

function encodeCursor(offset: number) {
  return Buffer.from(String(Math.max(0, offset))).toString("base64url");
}

export function decodeCursor(cursor: string | null | undefined) {
  if (!cursor) {
    return 0;
  }

  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const offset = Number.parseInt(decoded, 10);
    if (!Number.isFinite(offset) || offset < 0) {
      return 0;
    }
    return offset;
  } catch {
    return 0;
  }
}

async function resolveReviewIdsWithMedia(
  admin: SupabaseClient,
  filters: Pick<ReviewReadFilters, "storeId" | "productId">
): Promise<string[]> {
  const query = admin
    .from("review_media")
    .select("review_id,reviews!inner(id,store_id,product_id,status)")
    .eq("status", "active")
    .eq("reviews.status", "published")
    .eq("reviews.store_id", filters.storeId);

  const scoped = filters.productId
    ? query.eq("reviews.product_id", filters.productId)
    : query.is("reviews.product_id", null);

  const { data, error } = await scoped;
  if (error) {
    throw new Error(error.message);
  }

  const ids = new Set<string>();
  for (const row of (data ?? []) as Array<{ review_id?: string | null }>) {
    if (row.review_id) {
      ids.add(row.review_id);
    }
  }
  return Array.from(ids);
}

export async function listPublishedReviews(admin: SupabaseClient, filters: ReviewReadFilters) {
  let query = admin
    .from("reviews")
    .select(
      "id,store_id,product_id,review_type,reviewer_name,rating,title,body,verified_purchase,metadata,created_at,published_at,review_media(id,storage_path,public_url,mime_type,size_bytes,width,height,sort_order,status,created_at),review_responses(id,body,created_at,updated_at)"
    )
    .eq("status", "published")
    .eq("store_id", filters.storeId);

  query = filters.productId ? query.eq("product_id", filters.productId) : query.is("product_id", null);

  if (filters.rating) {
    query = query.eq("rating", filters.rating);
  }

  if (filters.verifiedOnly) {
    query = query.eq("verified_purchase", true);
  }

  if (filters.hasMedia) {
    const ids = await resolveReviewIdsWithMedia(admin, { storeId: filters.storeId, productId: filters.productId });
    if (ids.length === 0) {
      return { items: [], nextCursor: null as string | null };
    }
    query = query.in("id", ids);
  }

  if (filters.sort === "highest") {
    query = query.order("rating", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false });
  } else if (filters.sort === "lowest") {
    query = query.order("rating", { ascending: true }).order("created_at", { ascending: false }).order("id", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
  }

  const { data, error } = await query.range(filters.offset, filters.offset + filters.limit - 1);
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ReviewRow[];
  const items = rows.map((row) => {
    const media = (row.review_media ?? []).filter((asset) => asset.status === "active").sort((a, b) => a.sort_order - b.sort_order);
    const responseRaw = row.review_responses;
    const response = Array.isArray(responseRaw) ? responseRaw[0] : responseRaw;
    const incentiveDisclosure = readReviewIncentiveDisclosure(row.metadata);

    return {
      id: row.id,
      storeId: row.store_id,
      productId: row.product_id,
      reviewType: row.review_type,
      reviewerName: row.reviewer_name,
      rating: row.rating,
      title: row.title,
      body: row.body,
      verifiedPurchase: row.verified_purchase,
      incentiveDisclosure,
      createdAt: row.created_at,
      publishedAt: row.published_at,
      media: media.map((asset) => ({
        id: asset.id,
        storagePath: asset.storage_path,
        publicUrl: asset.public_url,
        mimeType: asset.mime_type,
        sizeBytes: asset.size_bytes,
        width: asset.width,
        height: asset.height,
        sortOrder: asset.sort_order,
        createdAt: asset.created_at
      })),
      response: response
        ? {
            id: response.id,
            body: response.body,
            createdAt: response.created_at,
            updatedAt: response.updated_at
          }
        : null
    };
  });

  const nextCursor = items.length === filters.limit ? encodeCursor(filters.offset + filters.limit) : null;
  return { items, nextCursor };
}

export async function buildReviewSummary(
  admin: SupabaseClient,
  input: Pick<ReviewReadFilters, "storeId" | "productId" | "verifiedOnly" | "hasMedia">
) {
  const baseQuery = () => {
    let query = admin.from("reviews").select("id", { count: "exact", head: true }).eq("status", "published").eq("store_id", input.storeId);
    query = input.productId ? query.eq("product_id", input.productId) : query.is("product_id", null);
    if (input.verifiedOnly) {
      query = query.eq("verified_purchase", true);
    }
    return query;
  };

  let mediaScopedIds: string[] | null = null;
  if (input.hasMedia) {
    mediaScopedIds = await resolveReviewIdsWithMedia(admin, { storeId: input.storeId, productId: input.productId });
    if (mediaScopedIds.length === 0) {
      return {
        reviewCount: 0,
        averageRating: 0,
        ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }
  }

  const ratingCounts = await Promise.all(
    [1, 2, 3, 4, 5].map(async (rating) => {
      let query = baseQuery().eq("rating", rating);
      if (mediaScopedIds) {
        query = query.in("id", mediaScopedIds);
      }
      const { count, error } = await query;
      if (error) {
        throw new Error(error.message);
      }
      return { rating, count: count ?? 0 };
    })
  );

  const ratings = {
    1: ratingCounts.find((item) => item.rating === 1)?.count ?? 0,
    2: ratingCounts.find((item) => item.rating === 2)?.count ?? 0,
    3: ratingCounts.find((item) => item.rating === 3)?.count ?? 0,
    4: ratingCounts.find((item) => item.rating === 4)?.count ?? 0,
    5: ratingCounts.find((item) => item.rating === 5)?.count ?? 0
  };

  const reviewCount = ratings[1] + ratings[2] + ratings[3] + ratings[4] + ratings[5];
  const weighted = ratings[1] + ratings[2] * 2 + ratings[3] * 3 + ratings[4] * 4 + ratings[5] * 5;
  const averageRating = reviewCount > 0 ? Number((weighted / reviewCount).toFixed(2)) : 0;

  return {
    reviewCount,
    averageRating,
    ratings
  };
}
