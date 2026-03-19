import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

type AuthorizationMock = {
  context: { globalRole: "user" | "support" | "admin"; userId: string; storeId: string; storeSlug: string; storeRole: "customer" };
  response: Response | null;
};

const requirePlatformRoleMock = vi.fn<(...args: unknown[]) => Promise<AuthorizationMock>>();
const enforceTrustedOriginMock = vi.fn<(request: NextRequest) => Response | null>();
const adminFromMock = vi.fn();
const sendPlatformTeamInviteEmailMock = vi.fn();
const logAuditEventMock = vi.fn();
const createInviteTokenMock = vi.fn();
const hashInviteTokenMock = vi.fn();
const resolveInviteExpiryMock = vi.fn();

vi.mock("@/lib/auth/authorization", () => ({
  requirePlatformRole: (...args: unknown[]) => requirePlatformRoleMock(...args)
}));

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...(args as [NextRequest]))
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

vi.mock("@/lib/notifications/platform-team-invites", () => ({
  sendPlatformTeamInviteEmail: (...args: unknown[]) => sendPlatformTeamInviteEmailMock(...args)
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

vi.mock("@/lib/stores/membership-invites", () => ({
  createInviteToken: (...args: unknown[]) => createInviteTokenMock(...args),
  hashInviteToken: (...args: unknown[]) => hashInviteTokenMock(...args),
  normalizeInviteEmail: (email: string) => email.trim().toLowerCase(),
  resolveInviteExpiry: (...args: unknown[]) => resolveInviteExpiryMock(...args)
}));

beforeEach(() => {
  requirePlatformRoleMock.mockReset();
  enforceTrustedOriginMock.mockReset();
  adminFromMock.mockReset();
  sendPlatformTeamInviteEmailMock.mockReset();
  logAuditEventMock.mockReset();
  createInviteTokenMock.mockReset();
  hashInviteTokenMock.mockReset();
  resolveInviteExpiryMock.mockReset();
  enforceTrustedOriginMock.mockReturnValue(null);
});

describe("platform team route", () => {
  test("returns active platform team members and invites", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "support", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: null
    });

    adminFromMock.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              order: vi.fn(() => ({
                order: vi.fn(() => ({
                  returns: vi.fn(async () => ({
                    data: [
                      { id: "u-admin", email: "admin@example.com", display_name: "Admin", global_role: "admin", created_at: "2026-01-01T00:00:00Z" }
                    ],
                    error: null
                  }))
                }))
              }))
            }))
          }))
        };
      }

      if (table === "platform_team_invites") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              returns: vi.fn(async () => ({
                data: [
                  {
                    id: "invite-1",
                    email: "support@example.com",
                    role: "support",
                    status: "pending",
                    expires_at: "2030-01-01T00:00:00Z",
                    created_at: "2026-03-01T00:00:00Z"
                  }
                ],
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/platform/team/route");
    const response = await route.GET();
    const payload = (await response.json()) as {
      members: Array<{ id: string }>;
      invites: Array<{ id: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.members).toHaveLength(1);
    expect(payload.invites).toHaveLength(1);
  });

  test("creates a platform team invite", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "admin", userId: "u-admin", storeId: "", storeSlug: "", storeRole: "customer" },
      response: null
    });
    createInviteTokenMock.mockReturnValue("invite-token");
    hashInviteTokenMock.mockReturnValue("invite-hash");
    resolveInviteExpiryMock.mockReturnValue("2030-01-01T00:00:00Z");
    sendPlatformTeamInviteEmailMock.mockResolvedValue({ ok: true });

    let userProfilesCall = 0;
    adminFromMock.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        userProfilesCall += 1;
        if (userProfilesCall === 1) {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null }))
              }))
            }))
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { display_name: "Admin Person", email: "admin@example.com" },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "platform_team_invites") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null }))
            }))
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: "invite-1",
                  email: "support@example.com",
                  role: "support",
                  status: "pending",
                  expires_at: "2030-01-01T00:00:00Z",
                  created_at: "2026-03-17T00:00:00Z"
                },
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/platform/team/route");
    const request = new NextRequest("http://localhost:3000/api/platform/team", {
      method: "POST",
      body: JSON.stringify({ email: "support@example.com", role: "support" }),
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" }
    });
    const response = await route.POST(request);
    const payload = (await response.json()) as {
      invite: { email: string; role: string };
      emailSent: boolean;
    };

    expect(response.status).toBe(201);
    expect(payload.invite).toMatchObject({ email: "support@example.com", role: "support" });
    expect(payload.emailSent).toBe(true);
    expect(sendPlatformTeamInviteEmailMock).toHaveBeenCalledTimes(1);
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });
});
