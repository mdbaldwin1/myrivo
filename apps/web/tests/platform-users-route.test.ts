import { beforeEach, describe, expect, test, vi } from "vitest";

type AuthorizationMock = {
  context: { globalRole: "user" | "support" | "admin"; userId: string; storeId: string; storeSlug: string; storeRole: "customer" };
  response: Response | null;
};

const requirePlatformRoleMock = vi.fn<(...args: unknown[]) => Promise<AuthorizationMock>>();
const adminFromMock = vi.fn();

vi.mock("@/lib/auth/authorization", () => ({
  requirePlatformRole: (...args: unknown[]) => requirePlatformRoleMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

function buildTableQuery(data: unknown, error: { message: string } | null = null) {
  return {
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(() => ({
          returns: vi.fn(async () => ({ data, error }))
        }))
      })),
      returns: vi.fn(async () => ({ data, error }))
    }))
  };
}

function buildCountQuery(count: number, error: { message: string } | null = null) {
  const result = { count, error };
  return {
    select: vi.fn(() => ({
      eq: vi.fn(async () => result),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result))
    }))
  };
}

beforeEach(() => {
  requirePlatformRoleMock.mockReset();
  adminFromMock.mockReset();
});

describe("platform users route", () => {
  test("returns 403 when platform access is denied", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "user", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: new Response(JSON.stringify({ error: "Insufficient platform role" }), { status: 403 })
    });

    const route = await import("@/app/api/platform/users/route");
    const response = await route.GET();
    expect(response.status).toBe(403);
  });

  test("returns users with membership context", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "support", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: null
    });

    const userCounts = [2, 1, 1, 0];
    let userCalls = 0;

    adminFromMock.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        userCalls += 1;
        if (userCalls === 1) {
          return buildTableQuery([
            { id: "u1", email: "admin@example.com", display_name: "Admin", global_role: "admin", created_at: "2026-01-01T00:00:00Z" },
            { id: "u2", email: "support@example.com", display_name: "Support", global_role: "support", created_at: "2026-01-02T00:00:00Z" }
          ]);
        }
        if (userCounts.length > 0) {
          return buildCountQuery(userCounts.shift() ?? 0);
        }
        throw new Error("Unexpected user_profiles query count call");
      }

      if (table === "store_memberships") {
        return {
          select: vi.fn(() => ({
            returns: vi.fn(async () => ({
              data: [
                { user_id: "u1", role: "owner", status: "active" },
                { user_id: "u1", role: "staff", status: "active" },
                { user_id: "u2", role: "staff", status: "suspended" }
              ],
              error: null
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/platform/users/route");
    const response = await route.GET();
    const payload = (await response.json()) as {
      summary: { usersTotal: number; userRoleCounts: Record<string, number> };
      users: Array<{ id: string; activeStoreCount: number; ownerStoreCount: number }>;
    };

    expect(response.status).toBe(200);
    expect(payload.summary.usersTotal).toBe(2);
    expect(payload.summary.userRoleCounts.admin).toBe(1);
    expect(payload.summary.userRoleCounts.support).toBe(1);
    expect(payload.users).toHaveLength(2);
    expect(payload.users[0]).toMatchObject({ id: "u1", activeStoreCount: 2, ownerStoreCount: 1 });
    expect(payload.users[1]).toMatchObject({ id: "u2", activeStoreCount: 0, ownerStoreCount: 0 });
  });
});
