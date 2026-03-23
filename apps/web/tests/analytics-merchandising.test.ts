import { describe, expect, test, vi } from "vitest";
import { getStorefrontMerchandisingSummary } from "@/lib/analytics/merchandising";

describe("storefront merchandising analytics", () => {
  test("aggregates top pages, products, searches, and newsletter conversion", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "storefront_events") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lte: vi.fn(async () => ({
                    data: [
                      { event_type: "page_view", path: "/products", product_id: null, session_id: "sess-1", value_json: {} },
                      { event_type: "page_view", path: "/products", product_id: null, session_id: "sess-2", value_json: {} },
                      { event_type: "product_view", path: "/products/body-oil", product_id: "prod-1", session_id: "sess-1", value_json: {} },
                      { event_type: "product_view", path: "/products/body-oil", product_id: "prod-1", session_id: "sess-2", value_json: {} },
                      { event_type: "product_view", path: "/products/candle", product_id: "prod-2", session_id: "sess-3", value_json: {} },
                      { event_type: "add_to_cart", path: "/products/body-oil", product_id: "prod-1", session_id: "sess-1", value_json: {} },
                      { event_type: "newsletter_subscribed", path: "/", product_id: null, session_id: "sess-2", value_json: {} },
                      { event_type: "search_performed", path: "/products", product_id: null, session_id: "sess-1", value_json: { query: "lavender", resultCount: 4 } }
                    ],
                    error: null
                  }))
                }))
              }))
            }))
          };
        }

        if (table === "order_items") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    lte: vi.fn(async () => ({
                      data: [
                        { product_id: "prod-1", quantity: 2, unit_price_cents: 2400, products: { title: "Body Oil" } }
                      ],
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          };
        }

        if (table === "storefront_sessions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lte: vi.fn(async () => ({
                    data: [{ id: "sess-1" }, { id: "sess-2" }, { id: "sess-3" }],
                    error: null
                  }))
                }))
              }))
            }))
          };
        }

        throw new Error(`Unexpected table ${table}`);
      })
    };

    const summary = await getStorefrontMerchandisingSummary({
      supabase: supabase as never,
      storeId: "store-1",
      range: "30d",
      now: new Date("2026-03-12T12:00:00.000Z")
    });

    expect(summary.topPages[0]).toEqual({ path: "/products", views: 2 });
    expect(summary.topProducts[0]).toMatchObject({ productId: "prod-1", views: 2, addToCart: 1, orders: 2, revenueCents: 4800 });
    expect(summary.topSearches[0]).toMatchObject({ query: "lavender", searches: 1, averageResults: 4 });
    expect(summary.newsletter.signups).toBe(1);
    expect(summary.newsletter.signupRate).toBeCloseTo(1 / 3);
  });
});
