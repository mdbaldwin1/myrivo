import { beforeEach, describe, expect, test, vi } from "vitest";

const adminFromMock = vi.fn();
const getStoreStripePaymentsReadinessMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

vi.mock("@/lib/stripe/store-payments-readiness", () => ({
  getStoreStripePaymentsReadiness: (...args: unknown[]) => getStoreStripePaymentsReadinessMock(...args)
}));

describe("store onboarding progress", () => {
  beforeEach(() => {
    vi.resetModules();
    adminFromMock.mockReset();
    getStoreStripePaymentsReadinessMock.mockReset();
  });

  test("marks payments incomplete when Stripe account exists but still needs setup", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "store_memberships") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                returns: vi.fn(async () => ({
                  data: [
                    {
                      role: "owner",
                      store: {
                        id: "store-1",
                        name: "Demo Store",
                        slug: "demo-store",
                        status: "draft",
                        has_launched_once: false,
                        status_reason_code: null,
                        status_reason_detail: null,
                        stripe_account_id: "acct_123"
                      }
                    }
                  ],
                  error: null
                }))
              }))
            }))
          }))
        };
      }

      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [],
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "store_settings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { store_id: "store-1", support_email: "owner@example.com" },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "store_branding") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { store_id: "store-1", logo_path: null, primary_color: "#111111", accent_color: "#222222" },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "products") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(async () => ({
                data: [{ id: "product-1" }],
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    getStoreStripePaymentsReadinessMock.mockResolvedValue({
      connected: true,
      readyForLiveCheckout: false,
      chargesEnabled: true,
      payoutsEnabled: true,
      taxReady: false,
      taxSettingsStatus: "pending"
    });

    const { getStoreOnboardingProgressForStore } = await import("@/lib/stores/onboarding");
    const progress = await getStoreOnboardingProgressForStore("user-1", "demo-store");

    expect(progress).toMatchObject({
      paymentStatus: "setup_required",
      steps: {
        payments: false
      },
      launchReady: false
    });
    expect(getStoreStripePaymentsReadinessMock).toHaveBeenCalledWith("acct_123");
  });
});
