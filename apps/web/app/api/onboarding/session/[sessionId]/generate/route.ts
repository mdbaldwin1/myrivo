import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runOnboardingGeneration } from "@/lib/onboarding/generation/service";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { getOnboardingSessionBundleForUser } from "@/lib/onboarding/session";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const onboardingGenerationSchema = z.object({
  storeId: z.string().uuid()
});

type GenerateRouteProps = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: NextRequest, { params }: GenerateRouteProps) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, onboardingGenerationSchema);
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

  try {
    const result = await runOnboardingGeneration({
      bundle,
      ownerUserId: user.id,
      ownerEmail: user.email ?? null
    });

    return NextResponse.json({
      ok: true,
      runId: result.runId,
      provider: result.provider,
      model: result.model
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to generate the onboarding starter package."
      },
      { status: 500 }
    );
  }
}
