import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const checkRateLimitMock = vi.fn();
const resolveStoreSlugFromRequestAsyncMock = vi.fn();
const adminFromMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args)
}));

vi.mock("@/lib/stores/active-store", () => ({
  resolveStoreSlugFromRequestAsync: (...args: unknown[]) => resolveStoreSlugFromRequestAsyncMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

function buildRequest() {
  return new NextRequest("http://localhost:3000/api/promotions/preview?store=sister-shop", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      host: "localhost:3000"
    },
    body: JSON.stringify({
      promoCode: "WELCOME10",
      subtotalCents: 2000
    })
  });
}

beforeEach(() => {
  vi.resetModules();
  enforceTrustedOriginMock.mockReset();
  checkRateLimitMock.mockReset();
  resolveStoreSlugFromRequestAsyncMock.mockReset();
  adminFromMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  checkRateLimitMock.mockResolvedValue(null);
  resolveStoreSlugFromRequestAsyncMock.mockResolvedValue("sister-shop");
});

describe("promotions preview route", () => {
  test("allows promo preview for a live store", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "store-1", status: "live" },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "promotions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    code: "WELCOME10",
                    discount_type: "percent",
                    discount_value: 10,
                    min_subtotal_cents: 0,
                    max_redemptions: null,
                    times_redeemed: 0,
                    starts_at: null,
                    ends_at: null,
                    is_active: true
                  },
                  error: null
                }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/promotions/preview/route");
    const response = await route.POST(buildRequest());
    const payload = (await response.json()) as { promoCode: string; discountCents: number };

    expect(response.status).toBe(200);
    expect(payload.promoCode).toBe("WELCOME10");
    expect(payload.discountCents).toBe(200);
  });
});
