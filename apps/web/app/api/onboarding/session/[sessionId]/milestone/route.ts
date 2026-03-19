import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { markOnboardingMilestone, onboardingMilestones } from "@/lib/onboarding/analytics";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { getOnboardingSessionBundleForUser } from "@/lib/onboarding/session";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const onboardingMilestoneSchema = z.object({
  storeId: z.string().uuid(),
  milestone: z.enum(onboardingMilestones)
});

type OnboardingMilestoneRouteProps = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: NextRequest, { params }: OnboardingMilestoneRouteProps) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, onboardingMilestoneSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const { sessionId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOnboardingSessionBundleForUser(user.id, payload.data.storeId);
  if (!bundle || bundle.session.id !== sessionId) {
    return NextResponse.json({ error: "Onboarding session not found." }, { status: 404 });
  }

  await markOnboardingMilestone({
    sessionId,
    storeId: bundle.store.id,
    milestone: payload.data.milestone
  });

  return NextResponse.json({ ok: true });
}
