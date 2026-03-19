import { beforeEach, describe, expect, test, vi } from "vitest";
import { resolveStoreSlugFromDomain } from "@/lib/stores/domain-store";

const adminFromMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

beforeEach(() => {
  adminFromMock.mockReset();
});

function buildStoreDomainsQuery(result: unknown) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => result)
        }))
      }))
    }))
  };
}

describe("resolveStoreSlugFromDomain", () => {
  test("returns slug for exact verified domain match", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table !== "store_domains") throw new Error(`Unexpected table ${table}`);
      return buildStoreDomainsQuery({
        data: {
          domain: "siftr.app",
          verification_status: "verified",
          stores: { slug: "at-home-apothecary", status: "live" }
        },
        error: null
      });
    });

    const slug = await resolveStoreSlugFromDomain("siftr.app");
    expect(slug).toBe("at-home-apothecary");
  });

  test("falls back from www host to apex domain when exact www record is missing", async () => {
    let callCount = 0;
    adminFromMock.mockImplementation((table: string) => {
      if (table !== "store_domains") throw new Error(`Unexpected table ${table}`);
      callCount += 1;
      if (callCount === 1) {
        return buildStoreDomainsQuery({
          data: null,
          error: null
        });
      }
      return buildStoreDomainsQuery({
        data: {
          domain: "siftr.app",
          verification_status: "verified",
          stores: { slug: "at-home-apothecary", status: "live" }
        },
        error: null
      });
    });

    const slug = await resolveStoreSlugFromDomain("www.siftr.app");
    expect(slug).toBe("at-home-apothecary");
  });

  test("can resolve verified offline domains when includeNonPublic is enabled", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table !== "store_domains") throw new Error(`Unexpected table ${table}`);
      return buildStoreDomainsQuery({
        data: {
          domain: "siftr.app",
          verification_status: "verified",
          stores: { slug: "at-home-apothecary", status: "offline" }
        },
        error: null
      });
    });

    await expect(resolveStoreSlugFromDomain("siftr.app")).resolves.toBeNull();
    await expect(resolveStoreSlugFromDomain("siftr.app", { includeNonPublic: true })).resolves.toBe("at-home-apothecary");
  });
});
