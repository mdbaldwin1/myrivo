import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const onboardingMilestones = [
  "first_product_completed",
  "reveal_viewed",
  "preview_home_viewed",
  "preview_products_viewed",
  "preview_about_viewed",
  "studio_handoff",
  "catalog_handoff",
  "payments_handoff",
  "launch_checklist_handoff"
] as const;

export type OnboardingMilestone = (typeof onboardingMilestones)[number];

const milestoneColumnByType: Record<OnboardingMilestone, string> = {
  first_product_completed: "first_product_completed_at",
  reveal_viewed: "reveal_viewed_at",
  preview_home_viewed: "preview_home_viewed_at",
  preview_products_viewed: "preview_products_viewed_at",
  preview_about_viewed: "preview_about_viewed_at",
  studio_handoff: "studio_handoff_at",
  catalog_handoff: "catalog_handoff_at",
  payments_handoff: "payments_handoff_at",
  launch_checklist_handoff: "launch_checklist_handoff_at"
};

type SessionMilestoneRow = {
  first_product_completed_at: string | null;
  reveal_viewed_at: string | null;
  preview_home_viewed_at: string | null;
  preview_products_viewed_at: string | null;
  preview_about_viewed_at: string | null;
  studio_handoff_at: string | null;
  catalog_handoff_at: string | null;
  payments_handoff_at: string | null;
  launch_checklist_handoff_at: string | null;
};

export async function markOnboardingMilestone(input: {
  sessionId: string;
  storeId: string;
  milestone: OnboardingMilestone;
}) {
  const admin = createSupabaseAdminClient();
  const column = milestoneColumnByType[input.milestone];
  const { data: session, error: loadError } = await admin
    .from("store_onboarding_sessions")
    .select(
      "first_product_completed_at,reveal_viewed_at,preview_home_viewed_at,preview_products_viewed_at,preview_about_viewed_at,studio_handoff_at,catalog_handoff_at,payments_handoff_at,launch_checklist_handoff_at"
    )
    .eq("id", input.sessionId)
    .eq("store_id", input.storeId)
    .maybeSingle<SessionMilestoneRow>();

  if (loadError) {
    throw new Error(loadError.message);
  }

  if (!session) {
    throw new Error("Onboarding session not found.");
  }

  if (session[column as keyof SessionMilestoneRow]) {
    return;
  }

  const { error: updateError } = await admin
    .from("store_onboarding_sessions")
    .update({
      [column]: new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    })
    .eq("id", input.sessionId)
    .eq("store_id", input.storeId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}
