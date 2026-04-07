import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const env = process.env;

describe("active store resolver", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...env };
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  });

  test("uses query store slug when provided", async () => {
    const { resolveStoreSlugFromRequest } = await import("@/lib/stores/active-store");
    const request = new NextRequest("https://example.com/api/promotions/preview?store=sister-shop");
    expect(resolveStoreSlugFromRequest(request)).toBe("sister-shop");
  });

  test("uses store slug header when query is missing", async () => {
    const { resolveStoreSlugFromRequest } = await import("@/lib/stores/active-store");
    const request = new NextRequest("https://example.com/api/promotions/preview", {
      headers: { "x-store-slug": "header-store" }
    });
    expect(resolveStoreSlugFromRequest(request)).toBe("header-store");
  });

  test("uses cookie slug when query and header are missing", async () => {
    const { resolveStoreSlugFromRequest } = await import("@/lib/stores/active-store");
    const request = new NextRequest("https://example.com/api/promotions/preview", {
      headers: { cookie: "myrivo_active_store_slug=cookie-store" }
    });
    expect(resolveStoreSlugFromRequest(request)).toBe("cookie-store");
  });

  test("returns null when request has no store selectors", async () => {
    const { resolveStoreSlugFromRequest } = await import("@/lib/stores/active-store");
    const request = new NextRequest("https://example.com/api/promotions/preview");
    expect(resolveStoreSlugFromRequest(request)).toBeNull();
  });

  test("does not create a storefront render hint from cookies alone", async () => {
    const { resolveStorefrontServerRenderHint } = await import("@/lib/stores/active-store");
    expect(resolveStorefrontServerRenderHint(null, null)).toBeNull();
    expect(resolveStorefrontServerRenderHint(undefined, "white-label-store")).toBe("white-label-store");
    expect(resolveStorefrontServerRenderHint("explicit-store", "white-label-store")).toBe("explicit-store");
  });
});
