import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const logAuditEventMock = vi.fn();
const getOwnedStoreBundleMock = vi.fn();

let insertedPromotionPayload: Record<string, unknown> | null = null;
let updatedPromotionPayload: Record<string, unknown> | null = null;

const supabaseMock = {
  auth: {
    getUser: vi.fn()
  },
  from: vi.fn((table: string) => {
    if (table !== "promotions") {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      insert: vi.fn((payload: Record<string, unknown>) => {
        insertedPromotionPayload = payload;
        return {
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
                data: {
                id: "22222222-2222-4222-8222-222222222222",
                code: "WELCOME10",
                discount_type: "percent",
                discount_value: 10,
                min_subtotal_cents: 0,
                max_redemptions: 100,
                per_customer_redemption_limit: 1,
                times_redeemed: 0,
                starts_at: null,
                ends_at: null,
                is_active: true,
                created_at: "2026-03-15T00:00:00.000Z"
              },
              error: null
            }))
          }))
        };
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        updatedPromotionPayload = payload;
        return {
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: "22222222-2222-4222-8222-222222222222",
                    code: "WELCOME10",
                    discount_type: "percent",
                    discount_value: 10,
                    min_subtotal_cents: 0,
                    max_redemptions: 100,
                    per_customer_redemption_limit: 2,
                    times_redeemed: 0,
                    starts_at: null,
                    ends_at: null,
                    is_active: true,
                    created_at: "2026-03-15T00:00:00.000Z"
                  },
                  error: null
                }))
              }))
            }))
          }))
        };
      })
    };
  })
};

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundle: (...args: unknown[]) => getOwnedStoreBundleMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => supabaseMock)
}));

beforeEach(() => {
  insertedPromotionPayload = null;
  updatedPromotionPayload = null;
  enforceTrustedOriginMock.mockReset();
  logAuditEventMock.mockReset();
  getOwnedStoreBundleMock.mockReset();
  supabaseMock.auth.getUser.mockReset();
  supabaseMock.from.mockClear();

  enforceTrustedOriginMock.mockReturnValue(null);
  supabaseMock.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-1" } }
  });
  getOwnedStoreBundleMock.mockResolvedValue({
    store: { id: "store-1", slug: "demo-store" },
    role: "owner"
  });
});

describe("promotions route", () => {
  test("POST persists the per-customer redemption limit", async () => {
    const route = await import("@/app/api/promotions/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/promotions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          code: "WELCOME10",
          discountType: "percent",
          discountValue: 10,
          maxRedemptions: 100,
          perCustomerRedemptionLimit: 1,
          isActive: true
        })
      })
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected promotions POST to return a response.");
    }
    expect(response.status).toBe(201);
    expect(insertedPromotionPayload).toEqual(
      expect.objectContaining({
        store_id: "store-1",
        code: "WELCOME10",
        per_customer_redemption_limit: 1
      })
    );
  });

  test("PATCH updates the per-customer redemption limit", async () => {
    const route = await import("@/app/api/promotions/route");
    const response = await route.PATCH(
      new NextRequest("http://localhost:3000/api/promotions", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          promotionId: "22222222-2222-4222-8222-222222222222",
          perCustomerRedemptionLimit: 2
        })
      })
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected promotions PATCH to return a response.");
    }
    expect(response.status).toBe(200);
    expect(updatedPromotionPayload).toEqual(
      expect.objectContaining({
        per_customer_redemption_limit: 2
      })
    );
  });
});
