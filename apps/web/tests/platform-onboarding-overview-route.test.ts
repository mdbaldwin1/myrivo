import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

type AuthorizationMock = {
  context: { globalRole: "user" | "support" | "admin"; userId: string; storeId: string; storeSlug: string; storeRole: "customer" };
  response: Response | null;
};

const requirePlatformRoleMock = vi.fn<(...args: unknown[]) => Promise<AuthorizationMock>>();
const getOnboardingAnalyticsSummaryMock = vi.fn();

vi.mock("@/lib/auth/authorization", () => ({
  requirePlatformRole: (...args: unknown[]) => requirePlatformRoleMock(...args)
}));

vi.mock("@/lib/onboarding/analytics-query", () => ({
  getOnboardingAnalyticsSummary: (...args: unknown[]) => getOnboardingAnalyticsSummaryMock(...args)
}));

beforeEach(() => {
  requirePlatformRoleMock.mockReset();
  getOnboardingAnalyticsSummaryMock.mockReset();
});

describe("platform onboarding overview route", () => {
  test("returns 403 when platform access is denied", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "user", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: new Response(JSON.stringify({ error: "Insufficient platform role" }), { status: 403 })
    });

    const route = await import("@/app/api/platform/onboarding/overview/route");
    const response = await route.GET(new NextRequest("http://localhost:3000/api/platform/onboarding/overview"));
    expect(response.status).toBe(403);
  });

  test("returns onboarding analytics summary for support role", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "support", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: null
    });
    getOnboardingAnalyticsSummaryMock.mockResolvedValueOnce({
      filters: { range: "30d", from: "2026-03-01T00:00:00.000Z", to: "2026-03-19T00:00:00.000Z" },
      totals: { sessionsStarted: 4 },
      funnel: [],
      timing: { avgMinutesToFirstPreview: 3.2, avgMinutesToGenerationSuccess: 2.1 },
      daily: []
    });

    const route = await import("@/app/api/platform/onboarding/overview/route");
    const response = await route.GET(new NextRequest("http://localhost:3000/api/platform/onboarding/overview?range=30d"));
    const payload = (await response.json()) as { summary: { totals: { sessionsStarted: number } } };

    expect(response.status).toBe(200);
    expect(getOnboardingAnalyticsSummaryMock).toHaveBeenCalledWith("30d");
    expect(payload.summary.totals.sessionsStarted).toBe(4);
  });
});
