import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const serverFromMock = vi.fn();
const authGetUserMock = vi.fn();
const adminFromMock = vi.fn();
const storageRemoveMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: (...args: unknown[]) => authGetUserMock(...args) },
    from: (...args: unknown[]) => serverFromMock(...args)
  }))
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args),
    storage: {
      from: vi.fn(() => ({
        remove: (...args: unknown[]) => storageRemoveMock(...args)
      }))
    }
  }))
}));

beforeEach(() => {
  vi.resetModules();
  enforceTrustedOriginMock.mockReset();
  serverFromMock.mockReset();
  authGetUserMock.mockReset();
  adminFromMock.mockReset();
  storageRemoveMock.mockReset();
  enforceTrustedOriginMock.mockReturnValue(null);
  authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "owner@example.com" } } });
  storageRemoveMock.mockResolvedValue({ error: null });
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
                avatar_path: null,
                global_role: "user",
                metadata: {}
              },
              error: null
            }))
          }))
        }))
      };
    });
    adminFromMock.mockImplementation((table: string) => serverFromMock(table));

    const route = await import("@/app/api/user/profile/route");
    const response = await route.GET();
    const payload = (await response.json()) as { profile: { preferences: { weeklyDigestEmails: boolean } } };

    expect(response.status).toBe(200);
    expect(payload.profile.preferences.weeklyDigestEmails).toBe(true);
  });

  test("PUT updates display name and preferences", async () => {
    let upsertPayload: Record<string, unknown> | null = null;

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
                avatar_path: null,
                global_role: "user",
                metadata: { color: "blue" }
              },
              error: null
            }))
          }))
        })),
        upsert: vi.fn((payload: Record<string, unknown>) => {
          upsertPayload = payload;
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: "user-1",
                  email: "owner@example.com",
                  display_name: "New Name",
                  avatar_path: "https://example.com/avatar.png",
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
          };
        })
      };
    });
    adminFromMock.mockImplementation((table: string) => serverFromMock(table));

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
    expect(upsertPayload).toMatchObject({
      id: "user-1",
      display_name: "New Name",
      metadata: {
        color: "blue",
        account_preferences: {
          weeklyDigestEmails: false,
          productAnnouncements: true,
          notificationSoundEnabled: false,
          orderAlertsEmail: true,
          orderAlertsInApp: true,
          inventoryAlertsEmail: true,
          inventoryAlertsInApp: true,
          systemAlertsEmail: true,
          systemAlertsInApp: true,
          teamAlertsEmail: true,
          teamAlertsInApp: true
        }
      }
    });
  });

  test("PUT provisions a missing profile row", async () => {
    let upsertPayload: Record<string, unknown> | null = null;

    serverFromMock.mockImplementation((table: string) => {
      if (table !== "user_profiles") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: null,
              error: null
            }))
          }))
        })),
        upsert: vi.fn((payload: Record<string, unknown>) => {
          upsertPayload = payload;
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: "user-1",
                  email: "owner@example.com",
                  display_name: "Owner User",
                  avatar_path: null,
                  global_role: "user",
                  metadata: {}
                },
                error: null
              }))
            }))
          };
        })
      };
    });
    adminFromMock.mockImplementation((table: string) => serverFromMock(table));

    const route = await import("@/app/api/user/profile/route");
    const request = new NextRequest("http://localhost:3000/api/user/profile", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({
        displayName: "Owner User"
      })
    });

    const response = await route.PUT(request);
    const payload = (await response.json()) as { ok: boolean; profile: { displayName: string | null } };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.profile.displayName).toBe("Owner User");
    expect(upsertPayload).toEqual({
      id: "user-1",
      email: "owner@example.com",
      global_role: "user",
      display_name: "Owner User"
    });
  });

  test("PUT returns 400 for malformed JSON payload", async () => {
    const route = await import("@/app/api/user/profile/route");
    const request = new NextRequest("http://localhost:3000/api/user/profile", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: "{"
    });

    const response = await route.PUT(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Invalid JSON");
  });
});
