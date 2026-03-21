import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const getUserMock = vi.fn();
const getOwnedStoreBundleForOptionalSlugMock = vi.fn();
const storesUpdateEqMock = vi.fn();
const logAuditEventMock = vi.fn();

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

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

describe("store payments tax decision route", () => {
  beforeEach(() => {
    vi.resetModules();
    enforceTrustedOriginMock.mockReset();
    getUserMock.mockReset();
    getOwnedStoreBundleForOptionalSlugMock.mockReset();
    storesUpdateEqMock.mockReset();
    logAuditEventMock.mockReset();

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
  });

  test("persists seller-attested no-tax mode with acknowledgement metadata", async () => {
    storesUpdateEqMock.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: {
            id: "store-1",
            tax_collection_mode: "seller_attested_no_tax",
            tax_compliance_acknowledged_at: "2026-03-20T16:00:00.000Z",
            tax_compliance_note: "Small friends-and-family sales only for now."
          },
          error: null
        }))
      }))
    });

    const route = await import("@/app/api/stores/payments/tax-decision/route");
    const response = await route.PATCH(
      new NextRequest("http://localhost:3000/api/stores/payments/tax-decision?storeSlug=test-store", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          mode: "seller_attested_no_tax",
          acknowledged: true,
          note: "Small friends-and-family sales only for now."
        })
      })
    );

    expect(response.status).toBe(200);
    expect(getOwnedStoreBundleForOptionalSlugMock).toHaveBeenCalledWith("user-1", "test-store", "admin");
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          source: "store_payments_tax_decision",
          tax_collection_mode: "seller_attested_no_tax"
        })
      })
    );
  });

  test("switches back to Stripe Tax and clears acknowledgement fields", async () => {
    storesUpdateEqMock.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: {
            id: "store-1",
            tax_collection_mode: "stripe_tax",
            tax_compliance_acknowledged_at: null,
            tax_compliance_note: null
          },
          error: null
        }))
      }))
    });

    const route = await import("@/app/api/stores/payments/tax-decision/route");
    const response = await route.PATCH(
      new NextRequest("http://localhost:3000/api/stores/payments/tax-decision?storeSlug=test-store", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          mode: "stripe_tax"
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      taxCollectionMode: "stripe_tax",
      taxComplianceAcknowledgedAt: null,
      taxComplianceNote: null
    });
  });

  test("clears the saved tax decision back to unconfigured", async () => {
    storesUpdateEqMock.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: {
            id: "store-1",
            tax_collection_mode: "unconfigured",
            tax_compliance_acknowledged_at: null,
            tax_compliance_note: null
          },
          error: null
        }))
      }))
    });

    const route = await import("@/app/api/stores/payments/tax-decision/route");
    const response = await route.DELETE(
      new NextRequest("http://localhost:3000/api/stores/payments/tax-decision?storeSlug=test-store", {
        method: "DELETE",
        headers: {
          origin: "http://localhost:3000",
          host: "localhost:3000"
        }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      taxCollectionMode: "unconfigured",
      taxComplianceAcknowledgedAt: null,
      taxComplianceNote: null
    });
  });

  test("returns a migration hint when tax decision columns are unavailable", async () => {
    storesUpdateEqMock.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: null,
          error: {
            message: "column stores.tax_collection_mode does not exist"
          }
        }))
      }))
    });

    const route = await import("@/app/api/stores/payments/tax-decision/route");
    const response = await route.PATCH(
      new NextRequest("http://localhost:3000/api/stores/payments/tax-decision?storeSlug=test-store", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          mode: "stripe_tax"
        })
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Store tax decision fields are not available yet. Apply the latest database migrations and try again."
    });
  });
});
