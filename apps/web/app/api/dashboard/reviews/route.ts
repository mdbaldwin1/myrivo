import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { filterDashboardReviewsByMedia } from "@/lib/reviews/dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundle, getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";

const querySchema = z.object({
  storeSlug: z.string().trim().min(1).max(120).optional(),
  status: z.enum(["all", "pending", "published", "rejected"]).default("all"),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  verified: z.enum(["true", "false"]).optional(),
  productId: z.string().uuid().optional(),
  hasMedia: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(5000).default(0)
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    storeSlug: request.nextUrl.searchParams.get("storeSlug") ?? undefined,
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    rating: request.nextUrl.searchParams.get("rating") ?? undefined,
    verified: request.nextUrl.searchParams.get("verified") ?? undefined,
    productId: request.nextUrl.searchParams.get("productId") ?? undefined,
    hasMedia: request.nextUrl.searchParams.get("hasMedia") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    offset: request.nextUrl.searchParams.get("offset") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = parsed.data.storeSlug
    ? await getOwnedStoreBundleForSlug(user.id, parsed.data.storeSlug, "staff")
    : await getOwnedStoreBundle(user.id, "staff");

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  let reviewIdsWithMedia: string[] | null = null;
  if (parsed.data.hasMedia) {
    let mediaQuery = supabase
      .from("review_media")
      .select("review_id,reviews!inner(id,store_id)")
      .eq("status", "active")
      .eq("reviews.store_id", bundle.store.id);

    if (parsed.data.productId) {
      mediaQuery = mediaQuery.eq("reviews.product_id", parsed.data.productId);
    }

    const { data: mediaRows, error: mediaError } = await mediaQuery;
    if (mediaError) {
      return NextResponse.json({ error: mediaError.message }, { status: 500 });
    }

    reviewIdsWithMedia = Array.from(new Set((mediaRows ?? []).map((row) => row.review_id).filter(Boolean)));
    if (reviewIdsWithMedia.length === 0) {
      if (parsed.data.hasMedia === "true") {
        return NextResponse.json({ items: [], pagination: { limit: parsed.data.limit, offset: parsed.data.offset } });
      }
    }
  }

  let query = supabase
    .from("reviews")
    .select(
      "id,store_id,product_id,order_id,review_type,reviewer_user_id,reviewer_email,reviewer_name,rating,title,body,verified_purchase,status,moderation_reason,metadata,published_at,created_at,updated_at,review_media(id,storage_path,public_url,mime_type,size_bytes,width,height,sort_order,status,moderation_reason,created_at,updated_at),review_responses(id,store_id,author_user_id,body,metadata,created_at,updated_at)"
    )
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false });

  if (parsed.data.status !== "all") {
    query = query.eq("status", parsed.data.status);
  }

  if (parsed.data.rating) {
    query = query.eq("rating", parsed.data.rating);
  }

  if (parsed.data.verified) {
    query = query.eq("verified_purchase", parsed.data.verified === "true");
  }

  if (parsed.data.productId) {
    query = query.eq("product_id", parsed.data.productId);
  }

  if (reviewIdsWithMedia && parsed.data.hasMedia === "true") {
    query = query.in("id", reviewIdsWithMedia);
  }

  const { data: items, error } = await query.range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filteredItems = filterDashboardReviewsByMedia(items ?? [], parsed.data.hasMedia);

  return NextResponse.json({
    items: filteredItems,
    pagination: {
      limit: parsed.data.limit,
      offset: parsed.data.offset
    }
  });
}
