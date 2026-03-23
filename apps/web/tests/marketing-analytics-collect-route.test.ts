import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { createCookieConsentRecord, serializeCookieConsent } from "@/lib/privacy/cookies";

const adminFromMock = vi.fn();
const cookiesMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: (...args: unknown[]) => cookiesMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

beforeEach(() => {
  vi.resetModules();
  adminFromMock.mockReset();
  cookiesMock.mockReset();
  cookiesMock.mockResolvedValue({
    get: vi.fn(() => undefined)
  });
});

describe("marketing analytics collect route", () => {
  const analyticsConsentCookie = `myrivo_cookie_consent=${serializeCookieConsent(createCookieConsentRecord({ analytics: true }))}`;

  test("ignores collection when analytics cookies are disabled", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined)
    });

    const route = await import("@/app/api/marketing/analytics/collect/route");
    const request = new NextRequest("http://localhost:3000/api/marketing/analytics/collect", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        referer: "http://localhost:3000/pricing",
        host: "localhost:3000",
        "x-forwarded-host": "localhost:3000"
      },
      body: JSON.stringify({
        entryPath: "/pricing",
        events: [{ eventType: "page_view", path: "/pricing", pageKey: "pricing" }]
      })
    });

    const response = await route.POST(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ignored: "analytics-disabled" });
    expect(adminFromMock).not.toHaveBeenCalled();
  });

  test("ignores collection when Global Privacy Control is active", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn((name: string) => {
        if (name === "myrivo_cookie_consent") {
          return {
            value: serializeCookieConsent(createCookieConsentRecord({ analytics: true }))
          };
        }
        return undefined;
      })
    });

    const route = await import("@/app/api/marketing/analytics/collect/route");
    const request = new NextRequest("http://localhost:3000/api/marketing/analytics/collect", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        referer: "http://localhost:3000/pricing",
        host: "localhost:3000",
        "x-forwarded-host": "localhost:3000",
        "sec-gpc": "1"
      },
      body: JSON.stringify({
        entryPath: "/pricing",
        events: [{ eventType: "page_view", path: "/pricing", pageKey: "pricing" }]
      })
    });

    const response = await route.POST(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ignored: "analytics-disabled" });
    expect(adminFromMock).not.toHaveBeenCalled();
  });

  test("persists a session, sanitizes payloads, and stores deduplicated marketing events", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn((name: string) => {
        if (name === "myrivo_cookie_consent") {
          return {
            value: serializeCookieConsent(createCookieConsentRecord({ analytics: true }))
          };
        }
        if (name === "myrivo_marketing_sid") {
          return {
            value: "existing-marketing-session"
          };
        }
        return undefined;
      })
    });

    const sessionUpsertMock = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: "marketing-session-1" }, error: null }))
      }))
    }));
    const eventsUpsertMock = vi.fn(async () => ({ error: null }));

    adminFromMock.mockImplementation((table: string) => {
      if (table === "marketing_sessions") {
        return { upsert: sessionUpsertMock };
      }
      if (table === "marketing_events") {
        return { upsert: eventsUpsertMock };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/marketing/analytics/collect/route");
    const request = new NextRequest("http://localhost:3000/api/marketing/analytics/collect", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        referer: "http://localhost:3000/pricing",
        host: "localhost:3000",
        "x-forwarded-host": "localhost:3000",
        cookie: `${analyticsConsentCookie}; myrivo_marketing_sid=existing-marketing-session`
      },
      body: JSON.stringify({
        entryPath: "/pricing?utm_source=instagram&utm_medium=social&ignore=nope",
        referrer: "https://google.com/search?q=myrivo",
        events: [
          {
            eventType: "page_view",
            path: "/pricing?utm_source=instagram&utm_medium=social&ignore=nope",
            pageKey: "pricing",
            experimentAssignments: {
              homepage_primary_cta_copy: "create_account"
            }
          },
          {
            eventType: "cta_click",
            path: "/pricing?utm_source=instagram&utm_medium=social&ignore=nope",
            pageKey: "pricing",
            sectionKey: "hero",
            ctaKey: "pricing_hero_start_free",
            ctaLabel: "Start free",
            value: {
              destination: "/signup?source=pricing",
              surface: "marketing_site",
              ignoreMe: "nope"
            },
            idempotencyKey: "marketing-cta-1"
          }
        ]
      })
    });

    const response = await route.POST(request);
    expect(response.status).toBe(200);
    expect((await response.json()) as { ok: boolean; sessionKey: string }).toEqual({
      ok: true,
      sessionKey: "existing-marketing-session"
    });

    const sessionCall = (sessionUpsertMock.mock.calls.at(0)?.at(0) ?? undefined) as
      | {
          session_key: string;
          entry_path: string | null;
          referrer_host: string | null;
          first_utm_source: string | null;
          last_utm_medium: string | null;
        }
      | undefined;
    expect(sessionCall?.session_key).toBe("existing-marketing-session");
    expect(sessionCall?.entry_path).toBe("/pricing?utm_source=instagram&utm_medium=social");
    expect(sessionCall?.referrer_host).toBe("google.com");
    expect(sessionCall?.first_utm_source).toBe("instagram");
    expect(sessionCall?.last_utm_medium).toBe("social");

    const eventRows = (eventsUpsertMock.mock.calls.at(0)?.at(0) ?? undefined) as
      | Array<{
          session_id: string;
          path: string | null;
          value_json: Record<string, unknown> | null;
          idempotency_key: string;
        }>
      | undefined;
    expect(eventRows).toHaveLength(2);
    expect(eventRows?.[0]?.session_id).toBe("marketing-session-1");
    expect(eventRows?.[0]?.path).toBe("/pricing?utm_source=instagram&utm_medium=social");
    expect(eventRows?.[1]?.value_json).toEqual({
      destination: "/signup?source=pricing",
      surface: "marketing_site"
    });
    expect(eventRows?.[1]?.idempotency_key).toBe("marketing-cta-1");
    expect(response.cookies.get("myrivo_marketing_sid")?.value).toBe("existing-marketing-session");
  });
});
