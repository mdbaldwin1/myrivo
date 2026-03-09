import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const checkRateLimitMock = vi.fn();
const adminFromMock = vi.fn();

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

beforeEach(() => {
  vi.resetModules();
  checkRateLimitMock.mockReset();
  adminFromMock.mockReset();
  checkRateLimitMock.mockResolvedValue(null);
});

describe("analytics collect route", () => {
  test("returns 400 for malformed payload", async () => {
    const route = await import("@/app/api/analytics/collect/route");
    const request = new NextRequest("http://localhost:3000/api/analytics/collect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeSlug: "demo", events: [{ eventType: "bad-event" }] })
    });
    const response = await route.POST(request);
    expect(response.status).toBe(400);
  });

  test("upserts session and deduplicates duplicate idempotency keys", async () => {
    const upsertEventMock = vi.fn(async () => ({ error: null }));
    const upsertSessionSingleMock = vi.fn(async () => ({ data: { id: "sess-1" }, error: null }));

    adminFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "store-1", slug: "demo-store", status: "active" },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "storefront_sessions") {
        return {
          upsert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: upsertSessionSingleMock
            }))
          }))
        };
      }

      if (table === "storefront_events") {
        return {
          upsert: upsertEventMock
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/analytics/collect/route");
    const request = new NextRequest("http://localhost:3000/api/analytics/collect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storeSlug: "demo-store",
        events: [
          { eventType: "page_view", idempotencyKey: "evt-1-duplicate-key", path: "/s/demo-store" },
          { eventType: "page_view", idempotencyKey: "evt-1-duplicate-key", path: "/products" },
          { eventType: "product_view", idempotencyKey: "evt-2-unique-key", path: "/products/a" }
        ]
      })
    });

    const response = await route.POST(request);
    const payload = (await response.json()) as { ok: boolean; acceptedEvents: number };
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.acceptedEvents).toBe(2);
    expect(upsertEventMock).toHaveBeenCalledTimes(1);

    const mockCalls = upsertEventMock.mock.calls as unknown[];
    expect(mockCalls.length).toBeGreaterThan(0);
    const firstCall = (mockCalls[0] ?? []) as unknown[];
    const upsertArgs = (firstCall[0] ?? []) as Array<{ idempotency_key: string | null }>;
    expect(upsertArgs).toHaveLength(2);
    expect(upsertArgs[0]?.idempotency_key).toBe("evt-1-duplicate-key");
    expect(upsertArgs[1]?.idempotency_key).toBe("evt-2-unique-key");
  });
});
