import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const authGetUserMock = vi.fn();
const serverFromMock = vi.fn();
const savedItemsUpsertMock = vi.fn();
const savedItemsDeleteEqUserMock = vi.fn();
const savedItemsDeleteEqIdMock = vi.fn();

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
  savedItemsUpsertMock.mockReset();
  savedItemsDeleteEqUserMock.mockReset();
  savedItemsDeleteEqIdMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "test@example.com" } } });
});

describe("customer saved-items route", () => {
  test("POST rejects product that does not belong to selected store", async () => {
    serverFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "11111111-1111-4111-8111-111111111111", slug: "curby", status: "active" },
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
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: "22222222-2222-4222-8222-222222222222",
                  store_id: "33333333-3333-4333-8333-333333333333",
                  status: "active",
                  price_cents: 1200
                },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "customer_saved_items") {
        return {
          upsert: savedItemsUpsertMock
        };
      }

      if (table === "product_variants") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/customer/saved-items/route");
    const request = new NextRequest("http://localhost:3000/api/customer/saved-items", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({
        storeId: "11111111-1111-4111-8111-111111111111",
        productId: "22222222-2222-4222-8222-222222222222"
      })
    });

    const response = await route.POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Product is unavailable");
    expect(savedItemsUpsertMock).not.toHaveBeenCalled();
  });

  test("DELETE rejects invalid id parameter", async () => {
    const route = await import("@/app/api/customer/saved-items/route");
    const request = new NextRequest("http://localhost:3000/api/customer/saved-items?id=bad", {
      method: "DELETE",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.DELETE(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Valid id is required");
  });

  test("DELETE removes saved item with valid id", async () => {
    savedItemsDeleteEqUserMock.mockResolvedValue({ error: null });
    savedItemsDeleteEqIdMock.mockReturnValue({ eq: savedItemsDeleteEqUserMock });

    serverFromMock.mockImplementation((table: string) => {
      if (table === "customer_saved_items") {
        return {
          delete: vi.fn(() => ({
            eq: savedItemsDeleteEqIdMock
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/customer/saved-items/route");
    const itemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const request = new NextRequest(`http://localhost:3000/api/customer/saved-items?id=${itemId}`, {
      method: "DELETE",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.DELETE(request);
    const payload = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(savedItemsDeleteEqIdMock).toHaveBeenCalledWith("id", itemId);
    expect(savedItemsDeleteEqUserMock).toHaveBeenCalledWith("user_id", "user-1");
  });
});
