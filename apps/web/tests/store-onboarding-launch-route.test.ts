import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const authGetUserMock = vi.fn();
const getOwnedStoreBundleForSlugMock = vi.fn();
const getStoreOnboardingProgressForStoreMock = vi.fn();
const getStoreStripePaymentsReadinessMock = vi.fn();
const notifyOwnersSystemSetupWarningMock = vi.fn();
const notifyOwnersStoreSubmittedForReviewMock = vi.fn();
const notifyPlatformAdminsStoreSubmittedForReviewMock = vi.fn();
const logAuditEventMock = vi.fn();
const storesUpdateEqStatusMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: (...args: unknown[]) => authGetUserMock(...args)
    },
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: (...args: unknown[]) => storesUpdateEqStatusMock(...args)
        }))
      }))
    }))
  }))
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundleForSlug: (...args: unknown[]) => getOwnedStoreBundleForSlugMock(...args)
}));

vi.mock("@/lib/stores/onboarding", () => ({
  getStoreOnboardingProgressForStore: (...args: unknown[]) => getStoreOnboardingProgressForStoreMock(...args)
}));

vi.mock("@/lib/stripe/store-payments-readiness", () => ({
  getStoreStripePaymentsReadiness: (...args: unknown[]) => getStoreStripePaymentsReadinessMock(...args)
}));

vi.mock("@/lib/notifications/owner-notifications", () => ({
  notifyOwnersSystemSetupWarning: (...args: unknown[]) => notifyOwnersSystemSetupWarningMock(...args),
  notifyOwnersStoreSubmittedForReview: (...args: unknown[]) => notifyOwnersStoreSubmittedForReviewMock(...args),
  notifyPlatformAdminsStoreSubmittedForReview: (...args: unknown[]) => notifyPlatformAdminsStoreSubmittedForReviewMock(...args)
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

describe("store onboarding launch route", () => {
  beforeEach(() => {
    vi.resetModules();
    enforceTrustedOriginMock.mockReset();
    authGetUserMock.mockReset();
    getOwnedStoreBundleForSlugMock.mockReset();
    getStoreOnboardingProgressForStoreMock.mockReset();
    getStoreStripePaymentsReadinessMock.mockReset();
    notifyOwnersSystemSetupWarningMock.mockReset();
    notifyOwnersStoreSubmittedForReviewMock.mockReset();
    notifyPlatformAdminsStoreSubmittedForReviewMock.mockReset();
    logAuditEventMock.mockReset();
    storesUpdateEqStatusMock.mockReset();

    enforceTrustedOriginMock.mockReturnValue(null);
    authGetUserMock.mockResolvedValue({
      data: {
        user: { id: "user-1" }
      }
    });
    getOwnedStoreBundleForSlugMock.mockResolvedValue({
      store: {
        id: "store-1",
        slug: "demo-store",
        stripe_account_id: "acct_123"
      }
    });
    getStoreOnboardingProgressForStoreMock.mockResolvedValue({
      id: "store-1",
      name: "Demo Store",
      slug: "demo-store",
      status: "draft",
      hasLaunchedOnce: false,
      role: "owner",
      canManageWorkspace: true,
      canLaunch: true,
      steps: {
        profile: true,
        branding: true,
        firstProduct: true,
        payments: true,
        launch: false
      },
      completedStepCount: 4,
      totalStepCount: 5,
      launchReady: true
    });
    storesUpdateEqStatusMock.mockResolvedValue({ error: null });
  });

  test("blocks launch submission when Stripe payments are not actually ready", async () => {
    getStoreStripePaymentsReadinessMock.mockResolvedValue({
      connected: true,
      readyForLiveCheckout: false,
      chargesEnabled: true,
      payoutsEnabled: true,
      taxReady: false,
      taxSettingsStatus: "pending"
    });

    const route = await import("@/app/api/stores/onboarding/launch/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/stores/onboarding/launch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({ slug: "demo-store" })
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Complete profile, branding, first product, and Stripe payments setup before launching this store."
    });
    expect(notifyOwnersSystemSetupWarningMock).toHaveBeenCalledWith(
      expect.objectContaining({
        missingSteps: ["Payments"]
      })
    );
    expect(storesUpdateEqStatusMock).not.toHaveBeenCalled();
  });

  test("submits the store for review when Stripe payments are ready", async () => {
    getStoreStripePaymentsReadinessMock.mockResolvedValue({
      connected: true,
      readyForLiveCheckout: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      taxReady: true,
      taxSettingsStatus: "active"
    });

    const route = await import("@/app/api/stores/onboarding/launch/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/stores/onboarding/launch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({ slug: "demo-store" })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      store: {
        id: "store-1",
        slug: "demo-store",
        status: "pending_review"
      }
    });
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
    expect(notifyOwnersStoreSubmittedForReviewMock).toHaveBeenCalledTimes(1);
    expect(notifyPlatformAdminsStoreSubmittedForReviewMock).toHaveBeenCalledTimes(1);
  });
});
