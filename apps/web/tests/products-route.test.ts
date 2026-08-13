import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const getUserMock = vi.fn();
const getOwnedStoreBundleMock = vi.fn();
const serverFromMock = vi.fn();
const adminFromMock = vi.fn();
const adminRpcMock = vi.fn();
const applyDigitalProductCatalogUpdateMock = vi.fn();

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
    from: (...args: unknown[]) => adminFromMock(...args),
    rpc: (...args: unknown[]) => adminRpcMock(...args)
  }))
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundle: (...args: unknown[]) => getOwnedStoreBundleMock(...args)
}));

vi.mock("@/lib/audit/log", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/notifications/owner-notifications", () => ({
  notifyOwnersInventoryLevel: vi.fn()
}));
vi.mock("@/lib/back-in-stock/alerts", () => ({
  findRestockedVariantIds: vi.fn(() => []),
  processBackInStockAlertsForVariants: vi.fn()
}));
vi.mock("@/lib/digital-products/readiness-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/digital-products/readiness-service")>(
    "@/lib/digital-products/readiness-service"
  );
  return {
    ...actual,
    applyDigitalProductCatalogUpdate: (...args: unknown[]) =>
      applyDigitalProductCatalogUpdateMock(...args)
  };
});

describe("products route", () => {
  beforeEach(() => {
    vi.resetModules();
    getUserMock.mockReset();
    getOwnedStoreBundleMock.mockReset();
    serverFromMock.mockReset();
    adminFromMock.mockReset();
    adminRpcMock.mockReset();
    applyDigitalProductCatalogUpdateMock.mockReset();

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

  test("PATCH returns structured readiness reasons before any digital catalog mutation", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "products") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    title: "Digital print",
                    status: "draft",
                    inventory_qty: 0,
                    product_type: "digital",
                    digital_rights_affirmed_at: "2026-08-12T12:00:00.000Z"
                  },
                  error: null
                }))
              }))
            }))
          }))
        };
      }
      if (table === "product_variants") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                returns: vi.fn(async () => ({ data: [], error: null }))
              }))
            }))
          }))
        };
      }
      throw new Error(`Unexpected admin table ${table}`);
    });
    applyDigitalProductCatalogUpdateMock.mockResolvedValue({
      applied: false,
      code: "digital_product_not_ready",
      reasons: [
        "preview_not_ready",
        "variant_missing_file:30000000-0000-4000-8000-000000000001"
      ]
    });

    const route = await import("@/app/api/products/route");
    const response = await route.PATCH(
      new NextRequest("http://localhost:3000/api/products", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          productId: "20000000-0000-4000-8000-000000000001",
          status: "active",
          hasVariants: true,
          variantTiersCount: 1,
          variantTierLevels: ["Style"],
          variants: [
            {
              id: "30000000-0000-4000-8000-000000000001",
              optionValue: "Printable",
              sku: "PRINTABLE",
              skuMode: "manual",
              priceCents: 1200,
              inventoryQty: 0,
              status: "active",
              isDefault: true
            }
          ]
        })
      })
    );
    if (!response) throw new Error("Expected a product update response");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "This digital product is not ready to publish.",
      code: "digital_product_not_ready",
      reasons: [
        "preview_not_ready",
        "variant_missing_file:30000000-0000-4000-8000-000000000001"
      ]
    });
    expect(applyDigitalProductCatalogUpdateMock).toHaveBeenCalledTimes(1);
  });
});
