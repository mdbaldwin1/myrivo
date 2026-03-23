import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const hashInviteTokenMock = vi.fn();
const acceptPlatformTeamInviteMock = vi.fn();
const adminFromMock = vi.fn();
const authGetUserMock = vi.fn();

vi.mock("@/lib/stores/membership-invites", () => ({
  hashInviteToken: (...args: unknown[]) => hashInviteTokenMock(...args)
}));

vi.mock("@/lib/platform/accept-team-invite", () => ({
  acceptPlatformTeamInvite: (...args: unknown[]) => acceptPlatformTeamInviteMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: (...args: unknown[]) => authGetUserMock(...args)
    }
  }))
}));

beforeEach(() => {
  hashInviteTokenMock.mockReset();
  acceptPlatformTeamInviteMock.mockReset();
  adminFromMock.mockReset();
  authGetUserMock.mockReset();
});

describe("platform team invite accept route", () => {
  test("accepts a pending platform invite for the signed-in user", async () => {
    authGetUserMock.mockResolvedValueOnce({
      data: {
        user: {
          id: "u1",
          email: "support@example.com"
        }
      }
    });
    hashInviteTokenMock.mockReturnValue("invite-hash");
    acceptPlatformTeamInviteMock.mockResolvedValue({
      ok: true,
      role: "support"
    });

    adminFromMock.mockImplementation((table: string) => {
      if (table !== "platform_team_invites") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                id: "invite-1",
                email: "support@example.com",
                role: "support",
                status: "pending",
                expires_at: "2030-01-01T00:00:00.000Z"
              },
              error: null
            }))
          }))
        }))
      };
    });

    const route = await import("@/app/api/platform/team/invites/accept/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/platform/team/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "abcdefghijklmnopqrstuvwxyz123456" })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, role: "support", redirectPath: "/dashboard/admin/team" });
    expect(acceptPlatformTeamInviteMock).toHaveBeenCalledTimes(1);
  });
});
