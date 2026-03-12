import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const hashInviteTokenMock = vi.fn();
const logAuditEventMock = vi.fn();
const notifyOwnersTeamInviteAcceptedMock = vi.fn();
const adminFromMock = vi.fn();
const updateUserByIdMock = vi.fn();
const authGetUserMock = vi.fn();

vi.mock("@/lib/stores/membership-invites", () => ({
  hashInviteToken: (...args: unknown[]) => hashInviteTokenMock(...args),
  normalizeInviteEmail: (email: string) => email.trim().toLowerCase()
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

vi.mock("@/lib/notifications/owner-notifications", () => ({
  notifyOwnersTeamInviteAccepted: (...args: unknown[]) => notifyOwnersTeamInviteAcceptedMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args),
    auth: {
      admin: {
        updateUserById: (...args: unknown[]) => updateUserByIdMock(...args)
      }
    }
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
  logAuditEventMock.mockReset();
  notifyOwnersTeamInviteAcceptedMock.mockReset();
  adminFromMock.mockReset();
  updateUserByIdMock.mockReset();
  authGetUserMock.mockReset();
});

describe("store membership invite accept route", () => {
  test("requires authenticated user", async () => {
    authGetUserMock.mockResolvedValueOnce({ data: { user: null } });
    const route = await import("@/app/api/stores/members/invites/accept/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/stores/members/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "some-long-token-value" })
      })
    );
    expect(response.status).toBe(401);
  });

  test("accepts valid invite for matching email", async () => {
    authGetUserMock.mockResolvedValueOnce({
      data: {
        user: {
          id: "u1",
          email: "staff@example.com",
          user_metadata: {
            pending_store_invite_token: "some-long-token-value"
          }
        }
      }
    });
    hashInviteTokenMock.mockReturnValue("hash-1");
    updateUserByIdMock.mockResolvedValue({ data: null, error: null });

    adminFromMock.mockImplementation((table: string) => {
      if (table === "store_membership_invites") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: "invite-1",
                  store_id: "store-1",
                  email: "staff@example.com",
                  role: "staff",
                  status: "pending",
                  expires_at: "2030-01-01T00:00:00.000Z",
                  store: { slug: "demo-store" }
                },
                error: null
              }))
            }))
          })),
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null }))
          }))
        };
      }
      if (table === "store_memberships") {
        return {
          upsert: vi.fn(async () => ({ error: null }))
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/stores/members/invites/accept/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/stores/members/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "some-long-token-value" })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, role: "staff", storeSlug: "demo-store" });
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
    expect(notifyOwnersTeamInviteAcceptedMock).toHaveBeenCalledTimes(1);
    expect(updateUserByIdMock).toHaveBeenCalledTimes(1);
  });
});
