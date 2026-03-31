import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const getUserMock = vi.fn();
const getOwnedStoreBundleForOptionalSlugMock = vi.fn();
const storesUpdateEqMock = vi.fn();
vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args)
    },
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: (...args: unknown[]) => storesUpdateEqMock(...args)
      }))
    }))
  }))
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundleForOptionalSlug: (...args: unknown[]) => getOwnedStoreBundleForOptionalSlugMock(...args)
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripeClient: vi.fn(() => ({
    accounts: {}
  }))
}));

describe("store payments connect route", () => {
  beforeEach(() => {
    vi.resetModules();
    enforceTrustedOriginMock.mockReset();
    getUserMock.mockReset();
    getOwnedStoreBundleForOptionalSlugMock.mockReset();
    storesUpdateEqMock.mockReset();

    enforceTrustedOriginMock.mockReturnValue(null);
    getUserMock.mockResolvedValue({
      data: {
        user: { id: "user-1" }
      }
    });
    getOwnedStoreBundleForOptionalSlugMock.mockResolvedValue({
      store: {
        id: "store-1",
        stripe_account_id: "acct_123",
        owner_user_id: "owner-1"
      }
    });
    storesUpdateEqMock.mockReturnValue({
      select: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          error: null,
          data: { id: "store-1" }
        }))
      }))
    });
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
  });

  test("clears the saved Stripe connection and resets local tax state", async () => {
    const route = await import("@/app/api/stores/payments/connect/route");
    const response = await route.DELETE(
      new NextRequest("http://localhost:3000/api/stores/payments/connect?storeSlug=test-store", {
        method: "DELETE",
        headers: {
          origin: "http://localhost:3000",
          host: "localhost:3000"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(getOwnedStoreBundleForOptionalSlugMock).toHaveBeenCalledWith("user-1", "test-store", "admin");
    await expect(response.json()).resolves.toEqual({
      connected: false,
      accountId: null,
      taxCollectionMode: "unconfigured",
      taxComplianceAcknowledgedAt: null,
      taxComplianceNote: null,
      disconnected: true
    });
  });

  test("allows a non-owner admin to clear the saved Stripe connection", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: { id: "admin-user" }
      }
    });
    getOwnedStoreBundleForOptionalSlugMock.mockResolvedValue({
      store: {
        id: "store-1",
        stripe_account_id: "acct_123",
        owner_user_id: "owner-user"
      }
    });

    const route = await import("@/app/api/stores/payments/connect/route");
    const response = await route.DELETE(
      new NextRequest("http://localhost:3000/api/stores/payments/connect?storeSlug=test-store", {
        method: "DELETE",
        headers: {
          origin: "http://localhost:3000",
          host: "localhost:3000"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(storesUpdateEqMock).toHaveBeenCalledTimes(1);
  });

  test("falls back to clearing only stripe_account_id when tax columns are unavailable", async () => {
    storesUpdateEqMock
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            error: {
              message: "column stores.tax_collection_mode does not exist"
            }
          }))
        }))
      })
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            error: null,
            data: { id: "store-1" }
          }))
        }))
      });

    const route = await import("@/app/api/stores/payments/connect/route");
    const response = await route.DELETE(
      new NextRequest("http://localhost:3000/api/stores/payments/connect?storeSlug=test-store", {
        method: "DELETE",
        headers: {
          origin: "http://localhost:3000",
          host: "localhost:3000"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(storesUpdateEqMock).toHaveBeenCalledTimes(2);
  });
});
