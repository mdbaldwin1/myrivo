import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const getOnboardingSessionBundleForUserMock = vi.fn();
const runOnboardingGenerationMock = vi.fn();
const markOnboardingMilestoneMock = vi.fn();
const updateOnboardingAnswersMock = vi.fn();
const updateOnboardingSessionMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/onboarding/session", () => ({
  getOnboardingSessionBundleForUser: (...args: unknown[]) => getOnboardingSessionBundleForUserMock(...args),
  updateOnboardingAnswers: (...args: unknown[]) => updateOnboardingAnswersMock(...args),
  updateOnboardingSession: (...args: unknown[]) => updateOnboardingSessionMock(...args)
}));

vi.mock("@/lib/onboarding/generation/service", () => ({
  runOnboardingGeneration: (...args: unknown[]) => runOnboardingGenerationMock(...args)
}));

vi.mock("@/lib/onboarding/analytics", () => ({
  onboardingMilestones: [
    "first_product_completed",
    "reveal_viewed",
    "preview_home_viewed",
    "preview_products_viewed",
    "preview_about_viewed",
    "studio_handoff",
    "catalog_handoff",
    "payments_handoff",
    "launch_checklist_handoff"
  ],
  markOnboardingMilestone: (...args: unknown[]) => markOnboardingMilestoneMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: {
            id: "11111111-1111-1111-1111-111111111111",
            email: "owner@example.com"
          }
        }
      }))
    }
  }))
}));

const storeId = "22222222-2222-4222-8222-222222222222";
const sessionId = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.resetModules();
  enforceTrustedOriginMock.mockReset();
  getOnboardingSessionBundleForUserMock.mockReset();
  updateOnboardingAnswersMock.mockReset();
  updateOnboardingSessionMock.mockReset();
  runOnboardingGenerationMock.mockReset();
  markOnboardingMilestoneMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  getOnboardingSessionBundleForUserMock.mockResolvedValue({
    store: {
      id: storeId,
      name: "Sunset Mercantile",
      slug: "sunset-mercantile"
    },
    session: {
      id: sessionId,
      status: "in_progress",
      current_step: "describeStore",
      last_completed_step: "logo",
      generation_requested_at: null
    },
    answers: {
      storeIdentity: { storeName: "Sunset Mercantile" }
    },
    stepProgress: {}
  });
  updateOnboardingAnswersMock.mockResolvedValue(undefined);
  updateOnboardingSessionMock.mockResolvedValue(undefined);
  markOnboardingMilestoneMock.mockResolvedValue(undefined);
  runOnboardingGenerationMock.mockResolvedValue({
    runId: "44444444-4444-4444-8444-444444444444",
    provider: "deterministic",
    model: "deterministic-v1"
  });
});

describe("onboarding session routes", () => {
  test("persists onboarding answers and session state", async () => {
    const route = await import("@/app/api/onboarding/session/[sessionId]/route");
    const response = await route.PATCH(
      new NextRequest(`http://localhost:3000/api/onboarding/session/${sessionId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          storeId,
          currentStep: "visualDirection",
          lastCompletedStep: "describeStore",
          status: "in_progress",
          answers: {
            storeIdentity: { storeName: "Sunset Mercantile" },
            storeProfile: { description: "A botanical wellness shop." }
          },
          stepProgress: {
            completedStepIds: ["logo", "describeStore"]
          }
        })
      }),
      { params: Promise.resolve({ sessionId }) }
    );

    expect(response.status).toBe(200);
    expect(updateOnboardingAnswersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        storeId,
        storeName: "Sunset Mercantile"
      })
    );
    expect(updateOnboardingSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        storeId,
        currentStep: "visualDirection",
        lastCompletedStep: "describeStore",
        status: "in_progress"
      })
    );
  }, 15000);

  test("runs the onboarding starter-package generation", async () => {
    const route = await import("@/app/api/onboarding/session/[sessionId]/generate/route");
    const response = await route.POST(
      new NextRequest(`http://localhost:3000/api/onboarding/session/${sessionId}/generate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          storeId
        })
      }),
      { params: Promise.resolve({ sessionId }) }
    );

    expect(response.status).toBe(200);
    expect(runOnboardingGenerationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bundle: expect.objectContaining({
          store: expect.objectContaining({
            id: storeId
          }),
          session: expect.objectContaining({
            id: sessionId
          })
        }),
        ownerUserId: "11111111-1111-1111-1111-111111111111",
        ownerEmail: "owner@example.com"
      })
    );
  }, 15000);

  test("returns a 500 when onboarding generation fails", async () => {
    runOnboardingGenerationMock.mockRejectedValueOnce(new Error("Provider unavailable."));

    const route = await import("@/app/api/onboarding/session/[sessionId]/generate/route");
    const response = await route.POST(
      new NextRequest(`http://localhost:3000/api/onboarding/session/${sessionId}/generate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          storeId
        })
      }),
      { params: Promise.resolve({ sessionId }) }
    );

    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(payload.error).toContain("Provider unavailable.");
  });

  test("records onboarding milestone events against the current session", async () => {
    const route = await import("@/app/api/onboarding/session/[sessionId]/milestone/route");
    const response = await route.POST(
      new NextRequest(`http://localhost:3000/api/onboarding/session/${sessionId}/milestone`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          storeId,
          milestone: "reveal_viewed"
        })
      }),
      { params: Promise.resolve({ sessionId }) }
    );

    expect(response.status).toBe(200);
    expect(markOnboardingMilestoneMock).toHaveBeenCalledWith({
      sessionId,
      storeId,
      milestone: "reveal_viewed"
    });
  });
});
