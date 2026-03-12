import { ReviewsModerationManager, type ReviewRow } from "@/components/dashboard/reviews-moderation-manager";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ storeSlug: string }>;
  searchParams?: Promise<{ reviewId?: string }>;
};

export default async function StoreWorkspaceReviewsPage({ params, searchParams }: PageProps) {
  const { storeSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const bundle = await getOwnedStoreBundleForSlug(user.id, storeSlug, "staff");
  if (!bundle) {
    return null;
  }

  const { data: reviews, error } = await supabase
    .from("reviews")
    .select(
      "id,product_id,reviewer_name,reviewer_email,rating,title,body,verified_purchase,status,moderation_reason,created_at,review_media(id,public_url,status,moderation_reason),review_responses(id,body)"
    )
    .eq("store_id", bundle.store.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (
    <ReviewsModerationManager
      storeSlug={storeSlug}
      initialItems={(reviews ?? []) as ReviewRow[]}
      initialReviewId={resolvedSearchParams?.reviewId?.trim() || null}
    />
  );
}
