import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { getOnboardingSessionBundleForUser, updateOnboardingAnswers, updateOnboardingSession } from "@/lib/onboarding/session";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const onboardingSessionPatchSchema = z.object({
  storeId: z.string().uuid(),
  currentStep: z.enum(["logo", "describeStore", "visualDirection", "firstProduct", "review"]).optional(),
  lastCompletedStep: z.enum(["logo", "describeStore", "visualDirection", "firstProduct", "review"]).nullable().optional(),
  status: z.enum(["in_progress", "generation_pending", "generation_running", "generation_failed", "reveal_ready", "completed", "abandoned"]).optional(),
  answers: z.any().optional(),
  stepProgress: z.record(z.string(), z.unknown()).optional()
});

type SessionRouteProps = {
  params: Promise<{ sessionId: string }>;
};

export async function PATCH(request: NextRequest, { params }: SessionRouteProps) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, onboardingSessionPatchSchema);
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

  if (payload.data.answers) {
    await updateOnboardingAnswers({
      sessionId,
      storeId: bundle.store.id,
      storeName: bundle.store.name,
      answers: payload.data.answers,
      stepProgress: payload.data.stepProgress
    });
  }

  await updateOnboardingSession({
    sessionId,
    storeId: bundle.store.id,
    currentStep: payload.data.currentStep,
    lastCompletedStep: payload.data.lastCompletedStep,
    status: payload.data.status
  });

  return NextResponse.json({ ok: true });
}
