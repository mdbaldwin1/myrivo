import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

type AuthContext = {
  context: { globalRole: "admin" | "support" | "user"; userId: string; storeId: string; storeSlug: string; storeRole: "customer" };
  response: Response | null;
};

const requirePlatformRoleMock = vi.fn<(...args: unknown[]) => Promise<AuthContext>>();
const adminFromMock = vi.fn();

vi.mock("@/lib/auth/authorization", () => ({
  requirePlatformRole: (...args: unknown[]) => requirePlatformRoleMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

beforeEach(() => {
  requirePlatformRoleMock.mockReset();
  adminFromMock.mockReset();
});

describe("platform audit route", () => {
  test("returns 403 when platform access is denied", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "user", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: new Response(JSON.stringify({ error: "Insufficient platform role" }), { status: 403 })
    });

    const route = await import("@/app/api/platform/audit/route");
    const request = new NextRequest("http://localhost:3000/api/platform/audit");
    const response = await route.GET(request);
    expect(response.status).toBe(403);
  });

  test("returns filtered event payload for support role", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "support", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: null
    });

    adminFromMock.mockImplementation((table: string) => {
      if (table === "audit_events") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                returns: vi.fn(async () => ({
                  data: [
                    {
                      id: "evt-1",
                      store_id: "store-1",
                      actor_user_id: "user-1",
                      action: "update",
                      entity: "store",
                      entity_id: "store-1",
                      metadata: { source: "platform_store_status" },
                      created_at: "2026-03-08T00:00:00Z"
                    }
                  ],
                  error: null
                }))
              }))
            }))
          }))
        };
      }

      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              returns: vi.fn(async () => ({
                data: [{ id: "store-1", name: "Demo", slug: "demo", status: "active" }],
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "user_profiles") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              returns: vi.fn(async () => ({
                data: [{ id: "user-1", email: "admin@example.com", display_name: "Admin", global_role: "admin" }],
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/platform/audit/route");
    const request = new NextRequest("http://localhost:3000/api/platform/audit");
    const response = await route.GET(request);
    const payload = (await response.json()) as { events: Array<{ id: string; store: { slug: string } | null }> };

    expect(response.status).toBe(200);
    expect(payload.events).toHaveLength(1);
    expect(payload.events[0]?.id).toBe("evt-1");
    expect(payload.events[0]?.store?.slug).toBe("demo");
  });
});
