import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

type AuthContext = {
  context: { globalRole: "admin" | "support" | "user"; userId: string; storeId: string; storeSlug: string; storeRole: "customer" };
  response: Response | null;
};

const requirePlatformRoleMock = vi.fn<(...args: unknown[]) => Promise<AuthContext>>();
const enforceTrustedOriginMock = vi.fn<(request: NextRequest) => Response | null>();
const logAuditEventMock = vi.fn();
const notifyOwnersStoreStatusChangedMock = vi.fn();
const adminFromMock = vi.fn();

vi.mock("@/lib/auth/authorization", () => ({
  requirePlatformRole: (...args: unknown[]) => requirePlatformRoleMock(...args)
}));

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...(args as [NextRequest]))
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

vi.mock("@/lib/notifications/owner-notifications", () => ({
  notifyOwnersStoreStatusChanged: (...args: unknown[]) => notifyOwnersStoreStatusChangedMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

beforeEach(() => {
  requirePlatformRoleMock.mockReset();
  enforceTrustedOriginMock.mockReset();
  logAuditEventMock.mockReset();
  notifyOwnersStoreStatusChangedMock.mockReset();
  adminFromMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  requirePlatformRoleMock.mockResolvedValue({
    context: { globalRole: "admin", userId: "admin-1", storeId: "", storeSlug: "", storeRole: "customer" },
    response: null
  });
});

describe("platform store status route", () => {
  test("approves a pending review store", async () => {
    const firstMaybeSingle = vi.fn(async () => ({
      data: { id: "store-1", name: "Demo", slug: "demo", status: "pending_review" },
      error: null
    }));
    const secondMaybeSingle = vi.fn(async () => ({
      data: { id: "store-1", name: "Demo", slug: "demo", status: "active" },
      error: null
    }));

    adminFromMock.mockImplementation((table: string) => {
      if (table !== "stores") {
        throw new Error(`Unexpected table ${table}`);
      }
      let callCount = 0;
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: () => {
              callCount += 1;
              return callCount === 1 ? firstMaybeSingle() : secondMaybeSingle();
            }
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: () => secondMaybeSingle()
            }))
          }))
        }))
      };
    });

    const route = await import("@/app/api/platform/stores/[storeId]/status/route");
    const request = new NextRequest("http://localhost:3000/api/platform/stores/store-1/status", {
      method: "PATCH",
      body: JSON.stringify({ action: "approve" }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.PATCH(request, { params: Promise.resolve({ storeId: "store-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      store: { id: "store-1", status: "active" }
    });
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
    expect(notifyOwnersStoreStatusChangedMock).toHaveBeenCalledTimes(1);
  });

  test("rejects approval when store is not pending review", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table !== "stores") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { id: "store-1", name: "Demo", slug: "demo", status: "draft" },
              error: null
            }))
          }))
        }))
      };
    });

    const route = await import("@/app/api/platform/stores/[storeId]/status/route");
    const request = new NextRequest("http://localhost:3000/api/platform/stores/store-1/status", {
      method: "PATCH",
      body: JSON.stringify({ action: "approve" }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.PATCH(request, { params: Promise.resolve({ storeId: "store-1" }) });
    expect(response.status).toBe(409);
  });

  test("requires reasonCode for reject action", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table !== "stores") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { id: "store-1", name: "Demo", slug: "demo", status: "pending_review" },
              error: null
            }))
          }))
        }))
      };
    });

    const route = await import("@/app/api/platform/stores/[storeId]/status/route");
    const request = new NextRequest("http://localhost:3000/api/platform/stores/store-1/status", {
      method: "PATCH",
      body: JSON.stringify({ action: "reject" }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.PATCH(request, { params: Promise.resolve({ storeId: "store-1" }) });
    expect(response.status).toBe(400);
  });
});
