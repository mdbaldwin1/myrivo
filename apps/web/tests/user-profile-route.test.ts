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
  authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "owner@example.com" } } });
});

describe("user profile route", () => {
  test("GET returns profile with default preferences", async () => {
    serverFromMock.mockImplementation((table: string) => {
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
                display_name: "Owner User",
                global_role: "user",
                metadata: {}
              },
              error: null
            }))
          }))
        }))
      };
    });

    const route = await import("@/app/api/user/profile/route");
    const response = await route.GET();
    const payload = (await response.json()) as { profile: { preferences: { weeklyDigestEmails: boolean } } };

    expect(response.status).toBe(200);
    expect(payload.profile.preferences.weeklyDigestEmails).toBe(true);
  });

  test("PUT updates display name and preferences", async () => {
    let updatePayload: Record<string, unknown> | null = null;

    serverFromMock.mockImplementation((table: string) => {
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
                display_name: "Old Name",
                global_role: "user",
                metadata: { color: "blue" }
              },
              error: null
            }))
          }))
        })),
        update: vi.fn((payload: Record<string, unknown>) => {
          updatePayload = payload;
          return {
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: "user-1",
                    email: "owner@example.com",
                    display_name: "New Name",
                    global_role: "user",
                    metadata: {
                      color: "blue",
                      account_preferences: {
                        weeklyDigestEmails: false,
                        productAnnouncements: true
                      }
                    }
                  },
                  error: null
                }))
              }))
            }))
          };
        })
      };
    });

    const route = await import("@/app/api/user/profile/route");
    const request = new NextRequest("http://localhost:3000/api/user/profile", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({
        displayName: "New Name",
        preferences: {
          weeklyDigestEmails: false,
          productAnnouncements: true
        }
      })
    });
    const response = await route.PUT(request);
    const payload = (await response.json()) as { ok: boolean; profile: { displayName: string | null } };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.profile.displayName).toBe("New Name");
    expect(updatePayload).toEqual({
      display_name: "New Name",
      metadata: {
        color: "blue",
        account_preferences: {
          weeklyDigestEmails: false,
          productAnnouncements: true
        }
      }
    });
  });
});
