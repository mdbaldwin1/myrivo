import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ReviewUploadErrorInput = {
  storeId: string;
  stage: "upload_url" | "complete" | "cleanup";
  reason: string;
  draftId: string;
  details?: Record<string, unknown>;
};

export async function logReviewUploadError(input: ReviewUploadErrorInput) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("audit_events").insert({
    store_id: input.storeId,
    actor_user_id: null,
    action: "upload_error",
    entity: "review_pipeline",
    entity_id: input.draftId,
    metadata: {
      source: "review_media",
      stage: input.stage,
      reason: input.reason,
      ...input.details
    }
  });

  if (error) {
    throw new Error(error.message);
  }
}
