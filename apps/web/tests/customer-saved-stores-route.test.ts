import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const authGetUserMock = vi.fn();
const serverFromMock = vi.fn();
const savedStoresDeleteEqUserMock = vi.fn();
const savedStoresDeleteEqStoreMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: (...args: unknown[]) => authGetUserMock(...args) },
    from: (...args: unknown[]) => serverFromMock(...args)
  }))
}));

beforeEach(() => {
  vi.resetModules();
  enforceTrustedOriginMock.mockReset();
  authGetUserMock.mockReset();
  serverFromMock.mockReset();
  savedStoresDeleteEqUserMock.mockReset();
  savedStoresDeleteEqStoreMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "test@example.com" } } });
});

describe("customer saved-stores route", () => {
  test("DELETE rejects invalid storeId parameter", async () => {
    const route = await import("@/app/api/customer/saved-stores/route");
    const request = new NextRequest("http://localhost:3000/api/customer/saved-stores?storeId=bad", {
      method: "DELETE",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.DELETE(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Valid storeId is required");
  });

  test("DELETE removes saved store with valid storeId", async () => {
    savedStoresDeleteEqUserMock.mockResolvedValue({ error: null });
    savedStoresDeleteEqStoreMock.mockReturnValue({ eq: savedStoresDeleteEqUserMock });

    serverFromMock.mockImplementation((table: string) => {
      if (table === "customer_saved_stores") {
        return {
          delete: vi.fn(() => ({
            eq: savedStoresDeleteEqStoreMock
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/customer/saved-stores/route");
    const storeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const request = new NextRequest(`http://localhost:3000/api/customer/saved-stores?storeId=${storeId}`, {
      method: "DELETE",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.DELETE(request);
    const payload = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(savedStoresDeleteEqStoreMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(savedStoresDeleteEqUserMock).toHaveBeenCalledWith("store_id", storeId);
  });
});
