import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PendingReviewRow = {
  id: string;
  store_id: string;
  product_id: string | null;
  reviewer_name: string | null;
  reviewer_email: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
};

type StoreRow = {
  id: string;
  slug: string;
  name: string;
};

type ProductRow = {
  id: string;
  name: string;
};

type FlaggedMediaRow = {
  id: string;
  review_id: string;
  status: "active" | "hidden" | "removed";
  moderation_reason: string | null;
  public_url: string;
  updated_at: string;
};

export async function GET() {
  const auth = await requirePlatformRole("support");
  if (auth.response) {
    return auth.response;
  }

  const admin = createSupabaseAdminClient();
  const [{ data: pendingReviews, error: reviewsError }, { data: flaggedMedia, error: mediaError }] = await Promise.all([
    admin
      .from("reviews")
      .select("id,store_id,product_id,reviewer_name,reviewer_email,rating,title,body,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(120)
      .returns<PendingReviewRow[]>(),
    admin
      .from("review_media")
      .select("id,review_id,status,moderation_reason,public_url,updated_at")
      .in("status", ["hidden", "removed"])
      .order("updated_at", { ascending: false })
      .limit(120)
      .returns<FlaggedMediaRow[]>()
  ]);

  if (reviewsError) {
    return NextResponse.json({ error: reviewsError.message }, { status: 500 });
  }
  if (mediaError) {
    return NextResponse.json({ error: mediaError.message }, { status: 500 });
  }

  const reviews = pendingReviews ?? [];
  const media = flaggedMedia ?? [];

  const storeIds = Array.from(new Set(reviews.map((review) => review.store_id)));
  const productIds = Array.from(new Set(reviews.map((review) => review.product_id).filter((id): id is string => Boolean(id))));
  const reviewIds = Array.from(new Set([...reviews.map((review) => review.id), ...media.map((item) => item.review_id)]));

  const [{ data: stores }, { data: products }, { data: mediaCounts }, { data: reviewStores }] = await Promise.all([
    storeIds.length
      ? admin.from("stores").select("id,slug,name").in("id", storeIds).returns<StoreRow[]>()
      : Promise.resolve({ data: [] as StoreRow[] }),
    productIds.length
      ? admin.from("products").select("id,name").in("id", productIds).returns<ProductRow[]>()
      : Promise.resolve({ data: [] as ProductRow[] }),
    reviewIds.length
      ? admin
          .from("review_media")
          .select("review_id,id")
          .eq("status", "active")
          .in("review_id", reviewIds)
          .returns<Array<{ review_id: string; id: string }>>()
      : Promise.resolve({ data: [] as Array<{ review_id: string; id: string }> }),
    reviewIds.length
      ? admin.from("reviews").select("id,store_id").in("id", reviewIds).returns<Array<{ id: string; store_id: string }>>()
      : Promise.resolve({ data: [] as Array<{ id: string; store_id: string }> })
  ]);

  const storeById = new Map((stores ?? []).map((store) => [store.id, store]));
  const productById = new Map((products ?? []).map((product) => [product.id, product]));
  const mediaCountByReviewId = (mediaCounts ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.review_id] = (acc[row.review_id] ?? 0) + 1;
    return acc;
  }, {});
  const reviewStoreById = new Map((reviewStores ?? []).map((row) => [row.id, row.store_id]));

  return NextResponse.json({
    role: auth.context?.globalRole ?? "user",
    summary: {
      pendingReviewsCount: reviews.length,
      flaggedMediaCount: media.length
    },
    pendingReviews: reviews.map((review) => {
      const store = storeById.get(review.store_id);
      const product = review.product_id ? productById.get(review.product_id) : null;
      return {
        ...review,
        store: store ? { id: store.id, slug: store.slug, name: store.name } : null,
        product: product ? { id: product.id, name: product.name } : null,
        activeMediaCount: mediaCountByReviewId[review.id] ?? 0
      };
    }),
    flaggedMedia: media.map((item) => {
      const storeId = reviewStoreById.get(item.review_id) ?? null;
      const store = storeId ? storeById.get(storeId) : null;
      return {
        ...item,
        store: store ? { id: store.id, slug: store.slug, name: store.name } : null
      };
    })
  });
}
