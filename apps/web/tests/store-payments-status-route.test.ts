import { beforeEach, describe, expect, test, vi } from "vitest";

const getUserMock = vi.fn();
const getOwnedStoreBundleForOptionalSlugMock = vi.fn();
const getStoreStripePaymentsReadinessMock = vi.fn();
const storesMaybeSingleMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args)
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: (...args: unknown[]) => storesMaybeSingleMock(...args)
        }))
      }))
    }))
  }))
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundleForOptionalSlug: (...args: unknown[]) => getOwnedStoreBundleForOptionalSlugMock(...args)
}));

vi.mock("@/lib/stripe/store-payments-readiness", () => ({
  getStoreStripePaymentsReadiness: (...args: unknown[]) => getStoreStripePaymentsReadinessMock(...args)
}));

describe("store payments status route", () => {
  beforeEach(() => {
    vi.resetModules();
    getUserMock.mockReset();
    getOwnedStoreBundleForOptionalSlugMock.mockReset();
    getStoreStripePaymentsReadinessMock.mockReset();
    storesMaybeSingleMock.mockReset();

    getUserMock.mockResolvedValue({
      data: {
        user: { id: "user-1" }
      }
    });

    getOwnedStoreBundleForOptionalSlugMock.mockResolvedValue({
      store: {
        id: "store-1",
        stripe_account_id: "acct_123"
      }
    });
    storesMaybeSingleMock.mockResolvedValue({
      data: {
        tax_collection_mode: "unconfigured",
        tax_compliance_acknowledged_at: null,
        tax_compliance_note: null
      },
      error: null
    });
  });

  test("returns Stripe tax readiness details for the store", async () => {
    getStoreStripePaymentsReadinessMock.mockResolvedValue({
      connected: true,
      accountId: "acct_123",
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      taxSettingsStatus: "pending",
      taxMissingFields: ["head_office.address.country"],
      taxReady: false,
      readyForLiveCheckout: false
    });

    const route = await import("@/app/api/stores/payments/status/route");
    const response = await route.GET(new Request("http://localhost:3000/api/stores/payments/status?storeSlug=test-store"));
    const payload = (await response.json()) as {
      taxSettingsStatus: string;
      taxMissingFields: string[];
      readyForLiveCheckout: boolean;
    };

    expect(response.status).toBe(200);
    expect(getOwnedStoreBundleForOptionalSlugMock).toHaveBeenCalledWith("user-1", "test-store", "staff");
    expect(getStoreStripePaymentsReadinessMock).toHaveBeenCalledWith("acct_123");
    expect(payload).toMatchObject({
      taxSettingsStatus: "pending",
      taxMissingFields: ["head_office.address.country"],
      readyForLiveCheckout: false,
      taxCollectionMode: "unconfigured",
      taxComplianceAcknowledgedAt: null,
      taxComplianceNote: null
    });
  });

  test("returns disconnected when the user has no store bundle", async () => {
    getOwnedStoreBundleForOptionalSlugMock.mockResolvedValue(null);

    const route = await import("@/app/api/stores/payments/status/route");
    const response = await route.GET(new Request("http://localhost:3000/api/stores/payments/status"));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(payload.error).toBe("No store found for account");
    expect(getStoreStripePaymentsReadinessMock).not.toHaveBeenCalled();
  });
});
