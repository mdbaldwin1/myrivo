import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const requireStorePermissionMock = vi.fn();
const enforceTrustedOriginMock = vi.fn();
const logAuditEventMock = vi.fn();
const createInviteTokenMock = vi.fn();
const hashInviteTokenMock = vi.fn();
const resolveInviteExpiryMock = vi.fn();

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  returns: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
};

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
  normalizeInviteEmail: (email: string) => email.trim().toLowerCase(),
  resolveInviteExpiry: (...args: unknown[]) => resolveInviteExpiryMock(...args)
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
  adminFromMock.mockReset();
  enforceTrustedOriginMock.mockReturnValue(null);
});

describe("store members route", () => {
  test("GET returns authorization error response", async () => {
    requireStorePermissionMock.mockResolvedValueOnce({
      context: null,
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
    });

    const route = await import("@/app/api/stores/members/route");
    const response = await route.GET(new NextRequest("http://localhost:3000/api/stores/members"));
    expect(response.status).toBe(403);
  });

  test("POST creates invite and returns token", async () => {
    requireStorePermissionMock.mockResolvedValue({
      context: { storeId: "store-1", userId: "owner-1" },
      response: null
    });
    createInviteTokenMock.mockReturnValue("token-abc");
    hashInviteTokenMock.mockReturnValue("hash-abc");
    resolveInviteExpiryMock.mockReturnValue("2030-01-01T00:00:00.000Z");

    adminFromMock.mockImplementation((table: string): Partial<QueryBuilder> => {
      if (table === "user_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null }))
            }))
          }))
        };
      }
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "store-1", owner_user_id: "owner-1" }, error: null }))
            }))
          }))
        };
      }
      if (table === "store_membership_invites") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ error: null }))
              }))
            }))
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: "invite-1",
                  email: "staff@example.com",
                  role: "staff",
                  status: "pending",
                  expires_at: "2030-01-01T00:00:00.000Z",
                  created_at: "2026-03-04T00:00:00.000Z"
                },
                error: null
              }))
            }))
          }))
        };
      }
      if (table === "store_memberships") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null }))
              }))
            }))
          }))
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/stores/members/route");
    const request = new NextRequest("http://localhost:3000/api/stores/members", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({ email: "staff@example.com", role: "staff" })
    });
    const response = await route.POST(request);
    const payload = (await response.json()) as { inviteToken: string };

    expect(response.status).toBe(201);
    expect(payload.inviteToken).toBe("token-abc");
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });
});
