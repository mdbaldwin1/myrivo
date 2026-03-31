import { beforeEach, describe, expect, test, vi } from "vitest";

const serverFromMock = vi.fn();
const adminFromMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined)
  }))
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: (...args: unknown[]) => serverFromMock(...args)
  }))
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

beforeEach(() => {
  serverFromMock.mockReset();
  adminFromMock.mockReset();
});

describe("getOwnedStoreBundle", () => {
  test("includes active admin-member stores in available stores", async () => {
    serverFromMock.mockImplementation((table: string) => {
      if (table === "store_memberships") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                returns: vi.fn(async () => ({
                  data: [
                    {
                      store_id: "store-1",
                      role: "admin",
                      status: "active",
                      permissions_json: {}
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
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [],
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "store_branding") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null }))
            }))
          }))
        };
      }

      if (table === "store_settings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null }))
            }))
          }))
        };
      }

      if (table === "store_content_blocks") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({ data: [], error: null }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected server table ${table}`);
    });

    adminFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [
                  {
                    id: "store-1",
                    name: "At Home Apothecary",
                    slug: "at-home-apothecary",
                    status: "live",
                    has_launched_once: true,
                    stripe_account_id: null
                  }
                ],
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected admin table ${table}`);
    });

    const { getOwnedStoreBundle } = await import("@/lib/stores/owner-store");
    const bundle = await getOwnedStoreBundle("user-1", "staff");

    expect(bundle?.store.slug).toBe("at-home-apothecary");
    expect(bundle?.role).toBe("admin");
    expect(bundle?.availableStores).toEqual([
      expect.objectContaining({
        id: "store-1",
        slug: "at-home-apothecary",
        role: "admin"
      })
    ]);
  });
});
