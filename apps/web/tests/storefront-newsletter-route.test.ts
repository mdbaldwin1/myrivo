import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const checkRateLimitMock = vi.fn();
const resolveStoreSlugFromRequestAsyncMock = vi.fn();

let insertedPayload: Record<string, unknown> | null = null;
let updatedPayload: Record<string, unknown> | null = null;
let subscriberLookupMode: "subscribe" | "unsubscribe" = "subscribe";

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

    if (table === "store_settings") {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({
          data: { email_capture_enabled: true },
          error: null
        }))
      };
      return chain;
    }

    if (table === "store_email_subscribers") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            ilike: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data:
                  subscriberLookupMode === "unsubscribe"
                    ? { id: "subscriber-1", status: "subscribed" }
                    : null,
                error: null
              }))
            }))
          }))
        })),
        insert: vi.fn(async (payload: Record<string, unknown>) => {
          insertedPayload = payload;
          return { error: null };
        }),
        update: vi.fn((payload: Record<string, unknown>) => {
          updatedPayload = payload;
          const chain = {
            eq: vi.fn(() => chain)
          };
          return chain;
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
  updatedPayload = null;
  subscriberLookupMode = "subscribe";
  enforceTrustedOriginMock.mockReset();
  checkRateLimitMock.mockReset();
  resolveStoreSlugFromRequestAsyncMock.mockReset();
  supabaseMock.from.mockClear();
  enforceTrustedOriginMock.mockReturnValue(null);
  checkRateLimitMock.mockResolvedValue(null);
  resolveStoreSlugFromRequestAsyncMock.mockResolvedValue("at-home-apothecary");
});

describe("storefront newsletter routes", () => {
  test("stores consent metadata when subscribing", async () => {
    const { POST } = await import("@/app/api/storefront/newsletter/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/storefront/newsletter?store=at-home-apothecary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          email: "shopper@example.com",
          source: "storefront_footer",
          location: "/s/at-home-apothecary"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(insertedPayload).toEqual(
      expect.objectContaining({
        source: "storefront_footer",
        metadata_json: expect.objectContaining({
          consent_source: "storefront_footer",
          consent_location: "/s/at-home-apothecary",
          suppression_reason: null
        })
      })
    );
  });

  test("stores suppression metadata when unsubscribing", async () => {
    subscriberLookupMode = "unsubscribe";

    const { POST } = await import("@/app/api/storefront/newsletter/unsubscribe/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/storefront/newsletter/unsubscribe?store=at-home-apothecary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          email: "shopper@example.com",
          source: "unsubscribe_form"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(updatedPayload).toEqual(
      expect.objectContaining({
        status: "unsubscribed",
        metadata_json: expect.objectContaining({
          suppression_reason: "user_unsubscribed",
          suppression_source: "unsubscribe_form"
        })
      })
    );
  });
});
