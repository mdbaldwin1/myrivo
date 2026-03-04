import { describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const resolveStoreSlugFromDomainMock = vi.fn();
const getSingleStoreSlugMock = vi.fn(() => "default-store");

vi.mock("@/lib/stores/domain-store", () => ({
  resolveStoreSlugFromDomain: (...args: unknown[]) => resolveStoreSlugFromDomainMock(...args)
}));

vi.mock("@/lib/stores/single-store", () => ({
  getSingleStoreSlug: () => getSingleStoreSlugMock()
}));

describe("active store async resolver", () => {
  test("uses domain mapping when request has no explicit store selectors", async () => {
    resolveStoreSlugFromDomainMock.mockResolvedValueOnce("domain-store");

    const request = new NextRequest("https://shop.example.com/api/storefront/cart-preview", {
      headers: { host: "shop.example.com" }
    });

    const { resolveStoreSlugFromRequestAsync } = await import("@/lib/stores/active-store");
    const slug = await resolveStoreSlugFromRequestAsync(request);

    expect(slug).toBe("domain-store");
  });

  test("keeps explicit store query precedence over domain mapping", async () => {
    resolveStoreSlugFromDomainMock.mockResolvedValueOnce("domain-store");

    const request = new NextRequest("https://shop.example.com/api/storefront/cart-preview?store=query-store", {
      headers: { host: "shop.example.com" }
    });

    const { resolveStoreSlugFromRequestAsync } = await import("@/lib/stores/active-store");
    const slug = await resolveStoreSlugFromRequestAsync(request);

    expect(slug).toBe("query-store");
  });
});
