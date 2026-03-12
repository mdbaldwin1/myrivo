import { describe, expect, test } from "vitest";
import { isStorefrontNavLinkActive } from "@/components/storefront/storefront-mobile-nav-sheet";

describe("storefront mobile nav link matching", () => {
  test("matches links by pathname even when href includes a store query", () => {
    expect(isStorefrontNavLinkActive("/products", "/products?store=at-home-apothecary")).toBe(true);
    expect(isStorefrontNavLinkActive("/policies", "/policies?store=at-home-apothecary")).toBe(true);
  });

  test("matches nested product detail paths against their parent section", () => {
    expect(isStorefrontNavLinkActive("/products/rose-clay-mask", "/products?store=at-home-apothecary")).toBe(true);
  });

  test("does not mark unrelated sections as active", () => {
    expect(isStorefrontNavLinkActive("/about", "/products?store=at-home-apothecary")).toBe(false);
    expect(isStorefrontNavLinkActive("/s/at-home-apothecary", "/products?store=at-home-apothecary")).toBe(false);
  });
});
