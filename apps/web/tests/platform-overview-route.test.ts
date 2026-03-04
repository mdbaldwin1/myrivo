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
      }))
    }))
  };
}

beforeEach(() => {
  requirePlatformRoleMock.mockReset();
  adminFromMock.mockReset();
});

describe("platform overview route", () => {
  test("returns 403 when platform access is denied", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "user", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: new Response(JSON.stringify({ error: "Insufficient platform role" }), { status: 403 })
    });

    const route = await import("@/app/api/platform/overview/route");
    const response = await route.GET();
    expect(response.status).toBe(403);
  });

  test("returns summary and lists for support role", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "support", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: null
    });

    adminFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return buildTableQuery([
          { id: "s1", name: "Store One", slug: "store-one", status: "active", mode: "live", created_at: "2026-01-01T00:00:00Z" }
        ]);
      }
      if (table === "user_profiles") {
        return buildTableQuery([
          { id: "u1", email: "admin@example.com", display_name: "Admin", global_role: "admin", created_at: "2026-01-01T00:00:00Z" },
          { id: "u2", email: "support@example.com", display_name: "Support", global_role: "support", created_at: "2026-01-02T00:00:00Z" }
        ]);
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/platform/overview/route");
    const response = await route.GET();
    const payload = (await response.json()) as { summary: { userRoleCounts: Record<string, number> }; stores: unknown[]; users: unknown[] };

    expect(response.status).toBe(200);
    expect(payload.stores).toHaveLength(1);
    expect(payload.users).toHaveLength(2);
    expect(payload.summary.userRoleCounts.admin).toBe(1);
    expect(payload.summary.userRoleCounts.support).toBe(1);
  });
});

