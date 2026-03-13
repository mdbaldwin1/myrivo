import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const checkRateLimitMock = vi.fn();
const resolveStoreSlugFromRequestAsyncMock = vi.fn();

let insertedPayload: Record<string, unknown> | null = null;

const supabaseMock = {
  from: vi.fn((table: string) => {
    if (table === "stores") {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({
          data: { id: "store-1", status: "active" },
          error: null
        }))
      };
      return chain;
    }

    if (table === "store_privacy_requests") {
      return {
        insert: vi.fn(async (payload: Record<string, unknown>) => {
          insertedPayload = payload;
          return { error: null };
        })
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  })
};

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
  createSupabaseAdminClient: vi.fn(() => supabaseMock)
}));

beforeEach(() => {
  insertedPayload = null;
  enforceTrustedOriginMock.mockReset();
  checkRateLimitMock.mockReset();
  resolveStoreSlugFromRequestAsyncMock.mockReset();
  supabaseMock.from.mockClear();
  enforceTrustedOriginMock.mockReturnValue(null);
  checkRateLimitMock.mockResolvedValue(null);
  resolveStoreSlugFromRequestAsyncMock.mockResolvedValue("at-home-apothecary");
});

describe("storefront privacy requests route", () => {
  test("submits a privacy request for an active store", async () => {
    const { POST } = await import("@/app/api/storefront/privacy-requests/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/storefront/privacy-requests?store=at-home-apothecary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          email: "Shopper@example.com",
          fullName: "Shopper",
          requestType: "deletion",
          details: "Please delete my information."
        })
      })
    );

    expect(response.status).toBe(200);
    expect(insertedPayload).toEqual(
      expect.objectContaining({
        store_id: "store-1",
        email: "shopper@example.com",
        full_name: "Shopper",
        request_type: "deletion"
      })
    );
  });
});
