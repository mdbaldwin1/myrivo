import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const authGetUserMock = vi.fn();
const adminFromMock = vi.fn();
const acceptStoreMembershipInviteMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: (...args: unknown[]) => authGetUserMock(...args)
    }
  }))
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

vi.mock("@/lib/stores/accept-membership-invite", () => ({
  acceptStoreMembershipInvite: (...args: unknown[]) => acceptStoreMembershipInviteMock(...args)
}));

beforeEach(() => {
  authGetUserMock.mockReset();
  adminFromMock.mockReset();
  acceptStoreMembershipInviteMock.mockReset();
});

describe("account store invites accept route", () => {
  test("accepts a pending invite for the authenticated user", async () => {
    authGetUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "staff@example.com"
        }
      }
    });
    adminFromMock.mockImplementation((table: string) => {
      if (table !== "store_membership_invites") {
        throw new Error(`Unexpected table ${table}`);
      }

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
        }))
      };
    });
    acceptStoreMembershipInviteMock.mockResolvedValue({
      ok: true,
      storeId: "store-1",
      storeSlug: "demo-store",
      role: "staff"
    });

    const route = await import("@/app/api/account/store-invites/[inviteId]/accept/route");
    const response = await route.POST(new NextRequest("http://localhost:3000/api/account/store-invites/invite-1/accept", { method: "POST" }), {
      params: Promise.resolve({ inviteId: "invite-1" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, storeSlug: "demo-store", role: "staff" });
    expect(acceptStoreMembershipInviteMock).toHaveBeenCalledTimes(1);
  });
});
