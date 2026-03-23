import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const getUserMock = vi.fn();
const getOwnedStoreBundleForOptionalSlugMock = vi.fn();
const deleteEqMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/env", () => ({
  getAppUrl: vi.fn(() => "https://www.myrivo.app")
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args)
    },
    from: vi.fn(() => ({
      delete: vi.fn(() => ({
        eq: (...args: unknown[]) => deleteEqMock(...args)
      }))
    }))
  }))
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundleForOptionalSlug: (...args: unknown[]) => getOwnedStoreBundleForOptionalSlugMock(...args)
}));

describe("store shipping route", () => {
  beforeEach(() => {
    vi.resetModules();
    enforceTrustedOriginMock.mockReset();
    getUserMock.mockReset();
    getOwnedStoreBundleForOptionalSlugMock.mockReset();
    deleteEqMock.mockReset();

    enforceTrustedOriginMock.mockReturnValue(null);
    getUserMock.mockResolvedValue({
      data: {
        user: { id: "user-1" }
      }
    });
    getOwnedStoreBundleForOptionalSlugMock.mockResolvedValue({
      store: {
        id: "store-1"
      }
    });
    deleteEqMock.mockResolvedValue({
      error: null
    });
  });

  test("clears the store shipping integration", async () => {
    const route = await import("@/app/api/stores/shipping/route");
    const response = await route.DELETE(
      new NextRequest("http://localhost:3000/api/stores/shipping?storeSlug=test-store", {
        method: "DELETE",
        headers: {
          origin: "http://localhost:3000",
          host: "localhost:3000"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(getOwnedStoreBundleForOptionalSlugMock).toHaveBeenCalledWith("user-1", "test-store", "staff");
    await expect(response.json()).resolves.toEqual({
      shippingProvider: "none",
      hasApiKey: false,
      hasWebhookSecret: false,
      webhookSecret: null,
      webhookUrl: "https://www.myrivo.app/api/shipping/webhook",
      source: "default"
    });
  });
});
