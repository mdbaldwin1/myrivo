import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const authGetUserMock = vi.fn();
const resolveStoreSlugFromRequestAsyncMock = vi.fn();
const serverFromMock = vi.fn();
const cartItemsInsertMock = vi.fn();
const cartDeleteEqMock = vi.fn();
const cartSelectStatusEqMock = vi.fn();
const cartSelectUserEqMock = vi.fn();
const cartSelectIdEqMock = vi.fn();
const cartUpdateEqUserMock = vi.fn();
const cartUpdateEqIdMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/stores/active-store", () => ({
  resolveStoreSlugFromRequestAsync: (...args: unknown[]) => resolveStoreSlugFromRequestAsyncMock(...args)
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
  resolveStoreSlugFromRequestAsyncMock.mockReset();
  serverFromMock.mockReset();
  cartItemsInsertMock.mockReset();
  cartDeleteEqMock.mockReset();
  cartSelectStatusEqMock.mockReset();
  cartSelectUserEqMock.mockReset();
  cartSelectIdEqMock.mockReset();
  cartUpdateEqUserMock.mockReset();
  cartUpdateEqIdMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "test@example.com" } } });
  resolveStoreSlugFromRequestAsyncMock.mockResolvedValue("curby");
});

describe("customer cart route", () => {
  test("GET reads the newest active cart without failing on duplicate active carts", async () => {
    serverFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "store-1", slug: "curby", status: "active" },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "customer_carts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: { id: "cart-newest", created_at: "2026-03-12T00:00:00.000Z" },
                        error: null
                      }))
                    }))
                  }))
                }))
              }))
            }))
          }))
        };
      }

      if (table === "customer_cart_items") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              returns: vi.fn(async () => ({
                data: [
                  {
                    product_id: "11111111-1111-4111-8111-111111111111",
                    product_variant_id: "22222222-2222-4222-8222-222222222222",
                    quantity: 2
                  }
                ],
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/customer/cart/route");
    const request = new NextRequest("http://localhost:3000/api/customer/cart?store=curby", {
      method: "GET"
    });

    const response = await route.GET(request);
    const payload = (await response.json()) as {
      items: Array<{ productId: string; variantId?: string; quantity: number }>;
    };

    expect(response.status).toBe(200);
    expect(payload.items).toEqual([
      {
        productId: "11111111-1111-4111-8111-111111111111",
        variantId: "22222222-2222-4222-8222-222222222222",
        quantity: 2
      }
    ]);
  });

  test("PUT persists validated items with price snapshots", async () => {
    const cartId = "cart-1";

    serverFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "store-1", slug: "curby", status: "active" },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "customer_carts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({ data: { id: cartId, created_at: "2026-03-12T00:00:00.000Z" }, error: null }))
                    }))
                  }))
                }))
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
                data: { id: "11111111-1111-4111-8111-111111111111", store_id: "store-1", status: "active", price_cents: 2300 },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "product_variants") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                data: {
                  id: "22222222-2222-4222-8222-222222222222",
                  store_id: "store-1",
                  product_id: "11111111-1111-4111-8111-111111111111",
                  status: "active",
                  price_cents: 2500
                },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "customer_cart_items") {
        return {
          delete: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null }))
          })),
          insert: cartItemsInsertMock.mockResolvedValue({ error: null })
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/customer/cart/route");
    const request = new NextRequest("http://localhost:3000/api/customer/cart?store=curby", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({
        items: [
          {
            productId: "11111111-1111-4111-8111-111111111111",
            variantId: "22222222-2222-4222-8222-222222222222",
            quantity: 1
          },
          {
            productId: "11111111-1111-4111-8111-111111111111",
            variantId: "22222222-2222-4222-8222-222222222222",
            quantity: 2
          }
        ]
      })
    });

    const response = await route.PUT(request);
    const payload = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(cartItemsInsertMock).toHaveBeenCalledTimes(1);
    const inserted = cartItemsInsertMock.mock.calls[0]?.[0] as Array<{ quantity: number; unit_price_snapshot_cents: number }>;
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.quantity).toBe(3);
    expect(inserted[0]?.unit_price_snapshot_cents).toBe(2500);
  });

  test("DELETE rejects invalid cartId parameter", async () => {
    const route = await import("@/app/api/customer/cart/route");
    const request = new NextRequest("http://localhost:3000/api/customer/cart?cartId=bad", {
      method: "DELETE",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.DELETE(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Valid cartId is required");
  });

  test("DELETE clears an active cart for the authenticated user", async () => {
    cartSelectStatusEqMock.mockReturnValue({
      maybeSingle: vi.fn(async () => ({ data: { id: "cart-1" }, error: null }))
    });
    cartSelectUserEqMock.mockReturnValue({ eq: cartSelectStatusEqMock });
    cartSelectIdEqMock.mockReturnValue({ eq: cartSelectUserEqMock });
    cartDeleteEqMock.mockResolvedValue({ error: null });
    cartUpdateEqUserMock.mockResolvedValue({ error: null });
    cartUpdateEqIdMock.mockReturnValue({ eq: cartUpdateEqUserMock });

    serverFromMock.mockImplementation((table: string) => {
      if (table === "customer_carts") {
        return {
          select: vi.fn(() => ({
            eq: cartSelectIdEqMock
          })),
          update: vi.fn(() => ({
            eq: cartUpdateEqIdMock
          }))
        };
      }

      if (table === "customer_cart_items") {
        return {
          delete: vi.fn(() => ({
            eq: cartDeleteEqMock
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/customer/cart/route");
    const request = new NextRequest("http://localhost:3000/api/customer/cart?cartId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
      method: "DELETE",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.DELETE(request);
    const payload = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(cartDeleteEqMock).toHaveBeenCalledWith("cart_id", "cart-1");
    expect(cartUpdateEqIdMock).toHaveBeenCalledWith("id", "cart-1");
    expect(cartUpdateEqUserMock).toHaveBeenCalledWith("user_id", "user-1");
  });
});
