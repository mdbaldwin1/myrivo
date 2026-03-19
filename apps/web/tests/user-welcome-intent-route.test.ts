import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const adminFromMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-1", email: "owner@example.com" } }
      }))
    }
  }))
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

let upsertPayload: Record<string, unknown> | null = null;

beforeEach(() => {
  enforceTrustedOriginMock.mockReset();
  adminFromMock.mockReset();
  upsertPayload = null;
  enforceTrustedOriginMock.mockReturnValue(null);

  adminFromMock.mockImplementation((table: string) => {
    if (table !== "user_profiles") {
      throw new Error(`Unexpected table ${table}`);
    }

    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: {
              id: "user-1",
              email: "owner@example.com",
              global_role: "user",
              metadata: {
                account_preferences: {
                  weeklyDigestEmails: true
                }
              }
            },
            error: null
          }))
        }))
      })),
      upsert: vi.fn(async (payload: Record<string, unknown>) => {
        upsertPayload = payload;
        return { error: null };
      })
    };
  });
});

describe("user welcome intent route", () => {
  test("persists the selected intent into profile metadata", async () => {
    const route = await import("@/app/api/user/welcome-intent/route");
    const response = await route.PUT(
      new NextRequest("http://localhost:3000/api/user/welcome-intent", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({ intent: "sell" })
      })
    );

    const payload = (await response.json()) as { ok?: boolean; intent?: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.intent).toBe("sell");
    expect(upsertPayload).toEqual({
      id: "user-1",
      metadata: {
        account_preferences: {
          weeklyDigestEmails: true
        },
        welcome_intent: "sell"
      }
    });
  });
});
