import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const checkRateLimitMock = vi.fn();
const adminFromMock = vi.fn();
const resolveStoreAnalyticsAccessByStoreIdMock = vi.fn();

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

vi.mock("@/lib/analytics/access", () => ({
  resolveStoreAnalyticsAccessByStoreId: (...args: unknown[]) => resolveStoreAnalyticsAccessByStoreIdMock(...args)
}));

beforeEach(() => {
  vi.resetModules();
  checkRateLimitMock.mockReset();
  adminFromMock.mockReset();
  resolveStoreAnalyticsAccessByStoreIdMock.mockReset();
  checkRateLimitMock.mockResolvedValue(null);
  resolveStoreAnalyticsAccessByStoreIdMock.mockResolvedValue({
    planKey: "standard",
    planAllowsAnalytics: true,
    collectionEnabled: true,
    dashboardEnabled: true
  });
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
    const upsertSessionMock = vi.fn(() => ({
      select: vi.fn(() => ({
        single: upsertSessionSingleMock
      }))
    }));
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
    const sessionUpsertCalls = upsertSessionMock.mock.calls as unknown as Array<[unknown]>;
    const sessionUpsertArgs = sessionUpsertCalls[0]?.[0] as
      | {
          first_entry_path?: string;
          last_entry_path?: string;
        }
      | undefined;
    expect(sessionUpsertArgs?.first_entry_path).toBe("/s/demo-store");
    expect(sessionUpsertArgs?.last_entry_path).toBe("/s/demo-store");
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
        attribution: {
          firstTouch: {
            entryPath: "/s/demo-store?utm_source=instagram",
            utmSource: "instagram"
          },
          lastTouch: {
            entryPath: "/products/body-oil?utm_source=email",
            utmSource: "email"
          }
        },
        events: [{ eventType: "page_view", path: "/s/demo-store" }]
      })
    });

    const response = await route.POST(request);
    const payload = (await response.json()) as { ok: boolean; sessionId: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.sessionId).toBe("existing_cookie_session_1234");

    const sessionUpsertCall = upsertSessionMock.mock.calls.at(0) as [{ session_key: string }] | undefined;
    const sessionUpsertArgs = sessionUpsertCall?.[0] as {
      session_key: string;
      first_entry_path?: string;
      first_utm_source?: string;
      last_entry_path?: string;
      last_utm_source?: string;
    };
    expect(sessionUpsertArgs?.session_key).toBe("existing_cookie_session_1234");
    expect(sessionUpsertArgs?.first_entry_path).toBe("/s/demo-store?utm_source=instagram");
    expect(sessionUpsertArgs?.first_utm_source).toBe("instagram");
    expect(sessionUpsertArgs?.last_entry_path).toBe("/products/body-oil?utm_source=email");
    expect(sessionUpsertArgs?.last_utm_source).toBe("email");
    expect(response.cookies.get("myrivo_analytics_sid")?.value).toBe("existing_cookie_session_1234");
  });

  test("generates idempotency keys when callers omit them", async () => {
    const upsertEventMock = vi.fn(async () => ({ error: null }));
    const upsertSessionMock = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: "sess-generated-idempotency" }, error: null }))
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storeSlug: "demo-store",
        events: [{ eventType: "page_view", path: "/s/demo-store" }]
      })
    });

    const response = await route.POST(request);
    expect(response.status).toBe(200);

    const mockCalls = upsertEventMock.mock.calls as unknown[];
    const firstCall = (mockCalls[0] ?? []) as unknown[];
    const upsertArgs = (firstCall[0] ?? []) as Array<{ idempotency_key: string }>;
    expect(upsertArgs).toHaveLength(1);
    expect(upsertArgs[0]?.idempotency_key).toMatch(/^evt_[a-z0-9]+$/);
  });

  test("sanitizes risky attribution and event payload values before persistence", async () => {
    const upsertEventMock = vi.fn(async () => ({ error: null }));
    const upsertSessionMock = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: "sess-governed" }, error: null }))
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storeSlug: "demo-store",
        entryPath: "/products/body-oil?utm_source=instagram&email=test@example.com",
        referrer: "https://google.com/search?q=test@example.com",
        attribution: {
          firstTouch: {
            entryPath: "/products/body-oil?utm_source=instagram&coupon=secret",
            referrerUrl: "https://newsletter.example.com/open?email=test@example.com"
          }
        },
        events: [
          {
            eventType: "search_performed",
            value: {
              query: "test@example.com",
              resultCount: 4,
              filters: { scent: ["lavender"] }
            }
          },
          {
            eventType: "checkout_started",
            value: {
              itemCount: 2,
              subtotalCents: 4200,
              customerEmail: "test@example.com",
              productIds: ["prod-1"]
            }
          }
        ]
      })
    });

    const response = await route.POST(request);
    expect(response.status).toBe(200);

    const sessionUpsertCall = upsertSessionMock.mock.calls.at(0) as [Record<string, unknown>] | undefined;
    expect(sessionUpsertCall?.[0]).toMatchObject({
      entry_path: "/products/body-oil?utm_source=instagram",
      referrer: "https://google.com/search",
      first_entry_path: "/products/body-oil?utm_source=instagram",
      first_referrer_url: "https://newsletter.example.com/open"
    });

    const eventUpsertCall = upsertEventMock.mock.calls.at(0) as [Array<Record<string, unknown>>] | undefined;
    expect(eventUpsertCall?.[0]?.[0]?.value_json).toMatchObject({
      resultCount: 4,
      queryRedacted: true
    });
    expect((eventUpsertCall?.[0]?.[0]?.value_json as Record<string, unknown>).query).toBeUndefined();
    expect(eventUpsertCall?.[0]?.[1]?.value_json).toMatchObject({
      itemCount: 2,
      subtotalCents: 4200
    });
    expect((eventUpsertCall?.[0]?.[1]?.value_json as Record<string, unknown>).customerEmail).toBeUndefined();
    expect((eventUpsertCall?.[0]?.[1]?.value_json as Record<string, unknown>).productIds).toBeUndefined();
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

  test("no-ops cleanly when collection is disabled for the store", async () => {
    const upsertEventMock = vi.fn(async () => ({ error: null }));
    const upsertSessionMock = vi.fn();
    resolveStoreAnalyticsAccessByStoreIdMock.mockResolvedValue({
      planKey: "starter",
      planAllowsAnalytics: false,
      collectionEnabled: false,
      dashboardEnabled: false
    });

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
        return { upsert: upsertSessionMock };
      }

      if (table === "storefront_events") {
        return { upsert: upsertEventMock };
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
    const payload = (await response.json()) as { ok: boolean; acceptedEvents: number; sessionId?: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.acceptedEvents).toBe(0);
    expect(payload.sessionId).toBeTruthy();
    expect(upsertSessionMock).not.toHaveBeenCalled();
    expect(upsertEventMock).not.toHaveBeenCalled();
  });
});
