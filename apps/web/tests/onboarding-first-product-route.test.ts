import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const getOnboardingSessionBundleForUserMock = vi.fn();
const saveOnboardingFirstProductMock = vi.fn();
const updateOnboardingSessionMock = vi.fn();
const markOnboardingMilestoneMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/onboarding/session", () => ({
  getOnboardingSessionBundleForUser: (...args: unknown[]) => getOnboardingSessionBundleForUserMock(...args),
  updateOnboardingSession: (...args: unknown[]) => updateOnboardingSessionMock(...args)
}));

vi.mock("@/lib/onboarding/first-product", () => ({
  saveOnboardingFirstProduct: (...args: unknown[]) => saveOnboardingFirstProductMock(...args)
}));

vi.mock("@/lib/onboarding/analytics", () => ({
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
  enforceTrustedOriginMock.mockReset();
  getOnboardingSessionBundleForUserMock.mockReset();
  saveOnboardingFirstProductMock.mockReset();
  updateOnboardingSessionMock.mockReset();
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
      current_step: "firstProduct",
      last_completed_step: "visualDirection",
      first_product_id: null
    },
    answers: {},
    stepProgress: {}
  });
  saveOnboardingFirstProductMock.mockResolvedValue({
    productId: "product-1",
    productTitle: "Lavender Soak"
  });
  updateOnboardingSessionMock.mockResolvedValue(undefined);
  markOnboardingMilestoneMock.mockResolvedValue(undefined);
});

describe("onboarding first product route", () => {
  test("creates the onboarding draft product and attaches it to the session", async () => {
    const route = await import("@/app/api/onboarding/session/[sessionId]/first-product/route");
    const response = await route.POST(
      new NextRequest(`http://localhost:3000/api/onboarding/session/${sessionId}/first-product`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          storeId,
          firstProduct: {
            title: "Lavender Soak",
            description: "A calming bath soak.",
            priceDollars: "24.00",
            optionMode: "none",
            inventoryMode: "made_to_order"
          }
        })
      }),
      { params: Promise.resolve({ sessionId }) }
    );

    const payload = (await response.json()) as { ok?: boolean; productId?: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.productId).toBe("product-1");
    expect(saveOnboardingFirstProductMock).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId,
        existingProductId: null,
        firstProduct: expect.objectContaining({
          title: "Lavender Soak",
          inventoryMode: "made_to_order"
        })
      })
    );
    expect(updateOnboardingSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        storeId,
        firstProductId: "product-1",
        currentStep: "firstProduct"
      })
    );
    expect(markOnboardingMilestoneMock).toHaveBeenCalledWith({
      sessionId,
      storeId,
      milestone: "first_product_completed"
    });
  });
});
