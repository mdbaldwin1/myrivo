import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const requireStorePermissionMock = vi.fn();
const enforceTrustedOriginMock = vi.fn();
const serverFromMock = vi.fn();

vi.mock("@/lib/auth/authorization", () => ({
  requireStorePermission: (...args: unknown[]) => requireStorePermissionMock(...args)
}));

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: (...args: unknown[]) => serverFromMock(...args)
  }))
}));

beforeEach(() => {
  requireStorePermissionMock.mockReset();
  enforceTrustedOriginMock.mockReset();
  serverFromMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  requireStorePermissionMock.mockResolvedValue({
    context: { storeId: "store-1", globalRole: "admin" },
    response: null
  });
});

describe("billing settings routes", () => {
  test("platform-config PUT returns 400 for malformed JSON", async () => {
    const route = await import("@/app/api/stores/platform-config/route");
    const request = new NextRequest("http://localhost:3000/api/stores/platform-config", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: "{"
    });

    const response = await route.PUT(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Invalid JSON");
    expect(serverFromMock).not.toHaveBeenCalled();
  });

  test("platform-config PUT rejects billing plan assignment for non-admin users", async () => {
    requireStorePermissionMock.mockResolvedValueOnce({
      context: { storeId: "store-1", globalRole: "user" },
      response: null
    });

    const route = await import("@/app/api/stores/platform-config/route");
    const request = new NextRequest("http://localhost:3000/api/stores/platform-config", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({ billingPlanKey: "standard" })
    });

    const response = await route.PUT(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toContain("Only platform admins");
    expect(serverFromMock).not.toHaveBeenCalled();
  });

  test("white-label PUT returns 400 for malformed JSON", async () => {
    const route = await import("@/app/api/stores/white-label/route");
    const request = new NextRequest("http://localhost:3000/api/stores/white-label", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: "{"
    });

    const response = await route.PUT(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Invalid JSON");
    expect(serverFromMock).not.toHaveBeenCalled();
  });

  test("white-label PUT updates store flag and returns enabled flag", async () => {
    const eqMock = vi.fn(async () => ({ error: null }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    serverFromMock.mockImplementation((table: string) => {
      if (table !== "stores") {
        throw new Error(`Unexpected table ${table}`);
      }
      return { update: updateMock };
    });

    const route = await import("@/app/api/stores/white-label/route");
    const request = new NextRequest("http://localhost:3000/api/stores/white-label", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({ enabled: false })
    });

    const response = await route.PUT(request);
    const payload = (await response.json()) as { enabled: boolean };

    expect(response.status).toBe(200);
    expect(payload.enabled).toBe(false);
    expect(updateMock).toHaveBeenCalledWith({ white_label_enabled: false });
    expect(eqMock).toHaveBeenCalledWith("id", "store-1");
  });
});
