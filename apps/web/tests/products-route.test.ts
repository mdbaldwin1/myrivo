import { beforeEach, describe, expect, test, vi } from "vitest";

const getUserMock = vi.fn();
const getOwnedStoreBundleMock = vi.fn();
const serverFromMock = vi.fn();
const adminFromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args)
    },
    from: (...args: unknown[]) => serverFromMock(...args)
  }))
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundle: (...args: unknown[]) => getOwnedStoreBundleMock(...args)
}));

describe("products route", () => {
  beforeEach(() => {
    vi.resetModules();
    getUserMock.mockReset();
    getOwnedStoreBundleMock.mockReset();
    serverFromMock.mockReset();
    adminFromMock.mockReset();

    getUserMock.mockResolvedValue({
      data: {
        user: { id: "user-1" }
      }
    });

    getOwnedStoreBundleMock.mockResolvedValue({
      store: { id: "store-1", slug: "demo-store" }
    });
  });

  test("GET returns variants for a team member using the admin client after access is resolved", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table !== "products") {
        throw new Error(`Unexpected admin table ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              returns: vi.fn(async () => ({
                data: [
                  {
                    id: "product-1",
                    title: "Whipped Tallow Balm",
                    description: "<p>Rich balm</p>",
                    slug: "whipped-tallow-balm",
                    sku: null,
                    image_urls: [],
                    image_alt_text: null,
                    seo_title: null,
                    seo_description: null,
                    is_featured: false,
                    price_cents: 1000,
                    inventory_qty: 49,
                    status: "active",
                    created_at: "2026-03-01T00:00:00.000Z",
                    product_variants: [
                      {
                        id: "variant-1",
                        title: "Unscented • 2 oz",
                        sku: "WHIPPED-TALLOW-BALM-UNSCENTED-2-OZ",
                        sku_mode: "auto",
                        image_urls: [],
                        group_image_urls: [],
                        option_values: { Size: "2 oz", Scent: "Unscented" },
                        price_cents: 1000,
                        inventory_qty: 0,
                        is_made_to_order: false,
                        is_default: true,
                        status: "active",
                        sort_order: 0,
                        created_at: "2026-03-01T00:00:00.000Z"
                      },
                      {
                        id: "variant-2",
                        title: "Vanilla Sandalwood • 4 oz",
                        sku: "WHIPPED-TALLOW-BALM-VANILLA-SANDALWOOD-4-OZ",
                        sku_mode: "auto",
                        image_urls: [],
                        group_image_urls: [],
                        option_values: { Size: "4 oz", Scent: "Vanilla Sandalwood" },
                        price_cents: 2500,
                        inventory_qty: 15,
                        is_made_to_order: false,
                        is_default: false,
                        status: "active",
                        sort_order: 1,
                        created_at: "2026-03-01T00:00:00.000Z"
                      }
                    ],
                    product_option_axes: []
                  }
                ],
                error: null
              }))
            }))
          }))
        }))
      };
    });

    const route = await import("@/app/api/products/route");
    const response = await route.GET();
    if (!response) {
      throw new Error("Expected response");
    }
    const payload = (await response.json()) as {
      products: Array<{ id: string; product_variants: Array<{ id: string }> }>;
    };

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(payload.products[0]?.product_variants.map((variant) => variant.id)).toEqual(["variant-1", "variant-2"]);
    expect(serverFromMock).not.toHaveBeenCalled();
  });
});
