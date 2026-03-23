import { beforeEach, describe, expect, test, vi } from "vitest";

const authGetUserMock = vi.fn();
const serverFromMock = vi.fn();
const getOwnedStoreBundleForOptionalSlugMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: (...args: unknown[]) => authGetUserMock(...args) },
    from: (...args: unknown[]) => serverFromMock(...args)
  }))
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundleForOptionalSlug: (...args: unknown[]) => getOwnedStoreBundleForOptionalSlugMock(...args)
}));

beforeEach(() => {
  vi.resetModules();
  authGetUserMock.mockReset();
  serverFromMock.mockReset();
  getOwnedStoreBundleForOptionalSlugMock.mockReset();
  authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  serverFromMock.mockImplementation((table: string) => {
    if (table !== "user_profiles") {
      throw new Error(`Unexpected table ${table}`);
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: { global_role: "user" }, error: null }))
        }))
      }))
    };
  });
});

describe("requireStorePermission", () => {
  test("returns 403 when permission override denies access", async () => {
    getOwnedStoreBundleForOptionalSlugMock.mockResolvedValue({
      store: { id: "store-1", slug: "curby" },
      role: "admin",
      permissionsJson: { "store.manage_domains": false }
    });

    const { requireStorePermission } = await import("@/lib/auth/authorization");
    const result = await requireStorePermission("store.manage_domains");

    expect(result.context).toBeNull();
    expect(result.response?.status).toBe(403);
  });

  test("returns context when permission is granted", async () => {
    getOwnedStoreBundleForOptionalSlugMock.mockResolvedValue({
      store: { id: "store-1", slug: "curby" },
      role: "staff",
      permissionsJson: { "store.manage_catalog": true }
    });

    const { requireStorePermission } = await import("@/lib/auth/authorization");
    const result = await requireStorePermission("store.manage_catalog");

    expect(result.response).toBeNull();
    expect(result.context).toMatchObject({
      userId: "user-1",
      storeId: "store-1",
      storeSlug: "curby",
      storeRole: "staff",
      globalRole: "user"
    });
  });
});
