import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn<(request: NextRequest) => Response | null>();
const getOwnedStoreBundleForOptionalSlugMock = vi.fn();
const logAuditEventMock = vi.fn();
const notifyOwnersStoreStatusChangedMock = vi.fn();
const expirePendingStorefrontCheckoutSessionsMock = vi.fn();
const authGetUserMock = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...(args as [NextRequest]))
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundleForOptionalSlug: (...args: unknown[]) => getOwnedStoreBundleForOptionalSlugMock(...args)
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

vi.mock("@/lib/notifications/owner-notifications", () => ({
  notifyOwnersStoreStatusChanged: (...args: unknown[]) => notifyOwnersStoreStatusChangedMock(...args)
}));

vi.mock("@/lib/storefront/checkout-finalization", () => ({
  expirePendingStorefrontCheckoutSessions: (...args: unknown[]) => expirePendingStorefrontCheckoutSessionsMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: (...args: unknown[]) => authGetUserMock(...args)
    },
    from: vi.fn((table: string) => {
      if (table === "stores") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: (...args: unknown[]) => maybeSingleMock(...args)
                }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  }))
}));

beforeEach(() => {
  enforceTrustedOriginMock.mockReset();
  getOwnedStoreBundleForOptionalSlugMock.mockReset();
  logAuditEventMock.mockReset();
  notifyOwnersStoreStatusChangedMock.mockReset();
  expirePendingStorefrontCheckoutSessionsMock.mockReset();
  authGetUserMock.mockReset();
  maybeSingleMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  expirePendingStorefrontCheckoutSessionsMock.mockResolvedValue(undefined);
});

describe("store current lifecycle route", () => {
  test("takes a live store offline", async () => {
    getOwnedStoreBundleForOptionalSlugMock.mockResolvedValue({
      store: { id: "store-1", slug: "demo-store", name: "Demo Store", status: "live" }
    });
    maybeSingleMock.mockResolvedValue({
      data: { id: "store-1", name: "Demo Store", slug: "demo-store", status: "offline" },
      error: null
    });

    const route = await import("@/app/api/stores/current/lifecycle/route");
    const request = new NextRequest("http://localhost:3000/api/stores/current/lifecycle", {
      method: "PATCH",
      body: JSON.stringify({ action: "go_offline" }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.PATCH(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      store: { id: "store-1", status: "offline" }
    });
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
    expect(notifyOwnersStoreStatusChangedMock).toHaveBeenCalledTimes(1);
    expect(expirePendingStorefrontCheckoutSessionsMock).toHaveBeenCalledWith("store-1");
  });

  test("brings an offline store live", async () => {
    getOwnedStoreBundleForOptionalSlugMock.mockResolvedValue({
      store: { id: "store-1", slug: "demo-store", name: "Demo Store", status: "offline" }
    });
    maybeSingleMock.mockResolvedValue({
      data: { id: "store-1", name: "Demo Store", slug: "demo-store", status: "live" },
      error: null
    });

    const route = await import("@/app/api/stores/current/lifecycle/route");
    const request = new NextRequest("http://localhost:3000/api/stores/current/lifecycle", {
      method: "PATCH",
      body: JSON.stringify({ action: "go_live" }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.PATCH(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      store: { id: "store-1", status: "live" }
    });
    expect(expirePendingStorefrontCheckoutSessionsMock).not.toHaveBeenCalled();
  });
});
