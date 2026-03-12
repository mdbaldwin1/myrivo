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

  test("reuses the analytics session from the cookie when payload session id is absent", async () => {
    const upsertEventMock = vi.fn(async () => ({ error: null }));
    const upsertSessionMock = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: "sess-cookie" }, error: null }))
      }))
    }));

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
          upsert: upsertSessionMock
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
      headers: {
        "content-type": "application/json",
        cookie: "myrivo_analytics_sid=existing_cookie_session_1234"
      },
      body: JSON.stringify({
        storeSlug: "demo-store",
        events: [{ eventType: "page_view", path: "/s/demo-store" }]
      })
    });

    const response = await route.POST(request);
    const payload = (await response.json()) as { ok: boolean; sessionId: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.sessionId).toBe("existing_cookie_session_1234");

    const sessionUpsertCall = upsertSessionMock.mock.calls.at(0) as [{ session_key: string }] | undefined;
    const sessionUpsertArgs = sessionUpsertCall?.[0];
    expect(sessionUpsertArgs?.session_key).toBe("existing_cookie_session_1234");
    expect(response.cookies.get("myrivo_analytics_sid")?.value).toBe("existing_cookie_session_1234");
  });

  test("rejects suspended stores before attempting session or event writes", async () => {
    const upsertEventMock = vi.fn(async () => ({ error: null }));
    const upsertSessionMock = vi.fn();

    adminFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "store-1", slug: "demo-store", status: "suspended" },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "storefront_sessions") {
        return {
          upsert: upsertSessionMock
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
        events: [{ eventType: "page_view", path: "/s/demo-store" }]
      })
    });

    const response = await route.POST(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(payload.error).toContain("not accepting analytics");
    expect(upsertSessionMock).not.toHaveBeenCalled();
    expect(upsertEventMock).not.toHaveBeenCalled();
  });
});
