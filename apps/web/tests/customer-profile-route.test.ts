import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const serverFromMock = vi.fn();
const authGetUserMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: (...args: unknown[]) => authGetUserMock(...args) },
    from: (...args: unknown[]) => serverFromMock(...args)
  }))
}));

beforeEach(() => {
  vi.resetModules();
  enforceTrustedOriginMock.mockReset();
  serverFromMock.mockReset();
  authGetUserMock.mockReset();
  enforceTrustedOriginMock.mockReturnValue(null);
  authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "test@example.com" } } });
});

describe("customer profile route", () => {
  test("GET returns empty default profile when none exists", async () => {
    serverFromMock.mockImplementation((table: string) => {
      if (table !== "customer_profiles") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null }))
          }))
        }))
      };
    });

    const route = await import("@/app/api/customer/profile/route");
    const response = await route.GET();
    const payload = (await response.json()) as { profile: { user_id: string } };

    expect(response.status).toBe(200);
    expect(payload.profile.user_id).toBe("user-1");
  });

  test("PUT upserts profile payload", async () => {
    serverFromMock.mockImplementation((table: string) => {
      if (table !== "customer_profiles") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: {
                id: "profile-1",
                user_id: "user-1",
                first_name: "Mike",
                last_name: "Baldwin",
                phone: "555-1234",
                default_shipping_address_json: { city: "Nashville" },
                preferences_json: { sms: true },
                created_at: "2026-03-03T00:00:00.000Z",
                updated_at: "2026-03-03T00:00:00.000Z"
              },
              error: null
            }))
          }))
        }))
      };
    });

    const route = await import("@/app/api/customer/profile/route");
    const request = new NextRequest("http://localhost:3000/api/customer/profile", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({
        firstName: "Mike",
        lastName: "Baldwin",
        phone: "555-1234",
        defaultShippingAddress: { city: "Nashville" },
        preferences: { sms: true }
      })
    });
    const response = await route.PUT(request);
    const payload = (await response.json()) as { ok: boolean; profile: { first_name: string } };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.profile.first_name).toBe("Mike");
  });
});
