import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const requireStorePermissionMock = vi.fn();
const enforceTrustedOriginMock = vi.fn();
const logAuditEventMock = vi.fn();
const createInviteTokenMock = vi.fn();
const hashInviteTokenMock = vi.fn();
const resolveInviteExpiryMock = vi.fn();
const sendStoreMembershipInviteEmailMock = vi.fn();
const adminFromMock = vi.fn();

vi.mock("@/lib/auth/authorization", () => ({
  requireStorePermission: (...args: unknown[]) => requireStorePermissionMock(...args)
}));

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

vi.mock("@/lib/stores/membership-invites", () => ({
  createInviteToken: (...args: unknown[]) => createInviteTokenMock(...args),
  hashInviteToken: (...args: unknown[]) => hashInviteTokenMock(...args),
  resolveInviteExpiry: (...args: unknown[]) => resolveInviteExpiryMock(...args)
}));

vi.mock("@/lib/notifications/team-invites", () => ({
  sendStoreMembershipInviteEmail: (...args: unknown[]) => sendStoreMembershipInviteEmailMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

beforeEach(() => {
  requireStorePermissionMock.mockReset();
  enforceTrustedOriginMock.mockReset();
  logAuditEventMock.mockReset();
  createInviteTokenMock.mockReset();
  hashInviteTokenMock.mockReset();
  resolveInviteExpiryMock.mockReset();
  sendStoreMembershipInviteEmailMock.mockReset();
  adminFromMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  requireStorePermissionMock.mockResolvedValue({
    context: { storeId: "store-1", userId: "owner-1", storeSlug: "demo-store", storeRole: "owner", globalRole: "user" },
    response: null
  });
  createInviteTokenMock.mockReturnValue("replacement-token");
  hashInviteTokenMock.mockReturnValue("replacement-hash");
  resolveInviteExpiryMock.mockReturnValue("2030-01-08T00:00:00.000Z");
  sendStoreMembershipInviteEmailMock.mockResolvedValue({ ok: true, provider: "resend", error: null });
});

describe("store member invite management route", () => {
  test("POST reissues a pending invite and emails the recipient", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "store_membership_invites") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "invite-1",
                    store_id: "store-1",
                    email: "staff@example.com",
                    role: "staff",
                    status: "pending",
                    expires_at: "2030-01-01T00:00:00.000Z",
                    created_at: "2026-03-12T00:00:00.000Z"
                  },
                  error: null
                }))
              }))
            }))
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null }))
            }))
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: "invite-2",
                  store_id: "store-1",
                  email: "staff@example.com",
                  role: "staff",
                  status: "pending",
                  expires_at: "2030-01-08T00:00:00.000Z",
                  created_at: "2026-03-12T01:00:00.000Z"
                },
                error: null
              }))
            }))
          }))
        };
      }
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "store-1", name: "Demo Store" }, error: null }))
            }))
          }))
        };
      }
      if (table === "user_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { display_name: "Owner User", email: "owner@example.com" },
                error: null
              }))
            }))
          }))
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/stores/members/invites/[inviteId]/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/stores/members/invites/invite-1", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
        body: JSON.stringify({ sendEmail: true })
      }),
      { params: Promise.resolve({ inviteId: "invite-1" }) }
    );

    const payload = (await response.json()) as { inviteToken: string; emailSent: boolean; invite: { id: string } };
    expect(response.status).toBe(200);
    expect(payload.invite.id).toBe("invite-2");
    expect(payload.inviteToken).toBe("replacement-token");
    expect(payload.emailSent).toBe(true);
    expect(sendStoreMembershipInviteEmailMock).toHaveBeenCalledTimes(1);
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });

  test("DELETE revokes a pending invite", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "store_membership_invites") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "invite-1",
                    store_id: "store-1",
                    email: "staff@example.com",
                    role: "staff",
                    status: "pending",
                    expires_at: "2030-01-01T00:00:00.000Z",
                    created_at: "2026-03-12T00:00:00.000Z"
                  },
                  error: null
                }))
              }))
            }))
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null }))
            }))
          }))
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/stores/members/invites/[inviteId]/route");
    const response = await route.DELETE(
      new NextRequest("http://localhost:3000/api/stores/members/invites/invite-1", {
        method: "DELETE",
        headers: { origin: "http://localhost:3000", host: "localhost:3000" }
      }),
      { params: Promise.resolve({ inviteId: "invite-1" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });
});
