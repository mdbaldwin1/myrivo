import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { getOnboardingAnalyticsSummary, type OnboardingAnalyticsRange } from "@/lib/onboarding/analytics-query";

const overviewSearchSchema = z.object({
  range: z.enum(["7d", "30d", "90d"]).optional()
});

export async function GET(request: NextRequest) {
  const auth = await requirePlatformRole("support");
  if (auth.response) {
    return auth.response;
  }

  const parsed = overviewSearchSchema.safeParse({
    range: request.nextUrl.searchParams.get("range") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding analytics range." }, { status: 400 });
  }

  const range = (parsed.data.range ?? "30d") as OnboardingAnalyticsRange;
  const summary = await getOnboardingAnalyticsSummary(range);

  return NextResponse.json({
    role: auth.context?.globalRole ?? "user",
    summary
  });
}
