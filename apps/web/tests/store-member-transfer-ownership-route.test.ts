import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const requireStorePermissionMock = vi.fn();
const enforceTrustedOriginMock = vi.fn();
const logAuditEventMock = vi.fn();
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

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

beforeEach(() => {
  requireStorePermissionMock.mockReset();
  enforceTrustedOriginMock.mockReset();
  logAuditEventMock.mockReset();
  adminFromMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  requireStorePermissionMock.mockResolvedValue({
    context: { storeId: "store-1", userId: "owner-1", storeSlug: "demo-store", storeRole: "owner", globalRole: "user" },
    response: null
  });
});

describe("store member ownership transfer route", () => {
  test("POST transfers store ownership to another active member", async () => {
    const storeUpdates: Array<Record<string, unknown>> = [];
    const membershipUpdates: Array<Record<string, unknown>> = [];
    let membershipSelectCount = 0;

    adminFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "store-1", owner_user_id: "owner-1" }, error: null }))
            }))
          })),
          update: vi.fn((payload: Record<string, unknown>) => {
            storeUpdates.push(payload);
            return {
              eq: vi.fn(async () => ({ error: null }))
            };
          })
        };
      }

      if (table === "store_memberships") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => {
                  membershipSelectCount += 1;
                  if (membershipSelectCount === 1) {
                    return {
                      data: {
                        id: "membership-2",
                        store_id: "store-1",
                        user_id: "admin-2",
                        role: "admin",
                        status: "active"
                      },
                      error: null
                    };
                  }

                  return {
                    data: {
                      id: "membership-1",
                      store_id: "store-1",
                      user_id: "owner-1",
                      role: "owner",
                      status: "active"
                    },
                    error: null
                  };
                })
              }))
            }))
          })),
          update: vi.fn((payload: Record<string, unknown>) => {
            membershipUpdates.push(payload);
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ error: null }))
              }))
            };
          })
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/stores/members/[membershipId]/transfer-ownership/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/stores/members/membership-2/transfer-ownership?storeSlug=demo-store", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000" }
      }),
      { params: Promise.resolve({ membershipId: "membership-2" }) }
    );
    const payload = (await response.json()) as { ok: boolean; nextOwnerUserId: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.nextOwnerUserId).toBe("admin-2");
    expect(storeUpdates).toEqual([{ owner_user_id: "admin-2" }]);
    expect(membershipUpdates).toEqual([{ role: "owner" }, { role: "admin" }]);
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });

  test("POST rejects non-owner actors", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "store-1", owner_user_id: "someone-else" }, error: null }))
            }))
          }))
        };
      }

      if (table === "store_memberships") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "membership-2",
                    store_id: "store-1",
                    user_id: "admin-2",
                    role: "admin",
                    status: "active"
                  },
                  error: null
                }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/stores/members/[membershipId]/transfer-ownership/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/stores/members/membership-2/transfer-ownership?storeSlug=demo-store", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000" }
      }),
      { params: Promise.resolve({ membershipId: "membership-2" }) }
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toContain("Only the current store owner");
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });
});
