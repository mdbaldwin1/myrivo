import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

type AuthorizationMock = {
  context: { globalRole: "user" | "support" | "admin"; userId: string; storeId: string; storeSlug: string; storeRole: "customer" };
  response: Response | null;
};

const requirePlatformRoleMock = vi.fn<(...args: unknown[]) => Promise<AuthorizationMock>>();
const enforceTrustedOriginMock = vi.fn<(request: NextRequest) => Response | null>();
const adminFromMock = vi.fn();

vi.mock("@/lib/auth/authorization", () => ({
  requirePlatformRole: (...args: unknown[]) => requirePlatformRoleMock(...args)
}));

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...(args as [NextRequest]))
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

beforeEach(() => {
  requirePlatformRoleMock.mockReset();
  enforceTrustedOriginMock.mockReset();
  adminFromMock.mockReset();
  enforceTrustedOriginMock.mockReturnValue(null);
});

describe("platform user role route", () => {
  test("returns 403 when user is not platform admin", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "support", userId: "u-support", storeId: "", storeSlug: "", storeRole: "customer" },
      response: new Response(JSON.stringify({ error: "Insufficient platform role" }), { status: 403 })
    });

    const route = await import("@/app/api/platform/users/[userId]/role/route");
    const request = new NextRequest("http://localhost:3000/api/platform/users/u1/role", {
      method: "PATCH",
      body: JSON.stringify({ globalRole: "admin" }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.PATCH(request, { params: Promise.resolve({ userId: "u1" }) });
    expect(response.status).toBe(403);
  });

  test("prevents demoting the last admin", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "admin", userId: "u-admin", storeId: "", storeSlug: "", storeRole: "customer" },
      response: null
    });

    adminFromMock.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return {
          select: vi.fn((_columns: string, options: { count: "exact"; head: true }) => ({
            eq: vi.fn(async () => ({ count: 1, error: null, options }))
          }))
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/platform/users/[userId]/role/route");
    const request = new NextRequest("http://localhost:3000/api/platform/users/u-admin/role", {
      method: "PATCH",
      body: JSON.stringify({ globalRole: "support" }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.PATCH(request, { params: Promise.resolve({ userId: "u-admin" }) });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "At least one platform admin is required." });
  });
});

