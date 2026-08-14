import { describe, expect, test } from "vitest";
import {
  buildStorefrontAboutPath,
  buildStorefrontCartPath,
  buildStorefrontHomePath,
  buildStorefrontProductPath,
  buildStorefrontProductsPath
} from "@/lib/storefront/paths";
import { resolveStorefrontRenderRouteBasePath } from "@/lib/storefront/load-storefront-data";

describe("storefront path helpers", () => {
  test("defaults to slug-prefixed storefront routes", () => {
    expect(buildStorefrontHomePath("at-home-apothecary")).toBe("/s/at-home-apothecary");
    expect(buildStorefrontProductsPath("at-home-apothecary")).toBe("/s/at-home-apothecary/products");
  });

  test("supports clean custom-domain storefront routes", () => {
    expect(buildStorefrontHomePath("at-home-apothecary", "")).toBe("/");
    expect(buildStorefrontProductsPath("at-home-apothecary", "")).toBe("/products");
    expect(buildStorefrontAboutPath("at-home-apothecary", "")).toBe("/about");
    expect(buildStorefrontCartPath("at-home-apothecary", "")).toBe("/cart");
    expect(buildStorefrontProductPath("at-home-apothecary", "whipped-tallow-balm", "")).toBe("/products/whipped-tallow-balm");
  });

  test("supports explicit slug route prefixes", () => {
    expect(buildStorefrontHomePath("at-home-apothecary", "/s/at-home-apothecary")).toBe("/s/at-home-apothecary");
    expect(buildStorefrontProductsPath("at-home-apothecary", "/s/at-home-apothecary")).toBe("/s/at-home-apothecary/products");
  });

  test("uses slug-prefixed links for explicit /s storefront renders", () => {
    expect(
      resolveStorefrontRenderRouteBasePath({
        currentPath: "/s/margies-flower-shop",
        explicitStoreSlug: "margies-flower-shop",
        singleStoreSlug: "margies-flower-shop"
      })
    ).toBe("/s/margies-flower-shop");
  });

  test("falls back to slug-prefixed links when an explicit slug render has no pathname header", () => {
    expect(
      resolveStorefrontRenderRouteBasePath({
        currentPath: "",
        explicitStoreSlug: "margies-flower-shop",
        singleStoreSlug: "margies-flower-shop"
      })
    ).toBe("/s/margies-flower-shop");
  });

  test("keeps clean links for custom-domain storefront renders", () => {
    expect(
      resolveStorefrontRenderRouteBasePath({
        currentPath: "/products",
        explicitStoreSlug: null,
        singleStoreSlug: "margies-flower-shop"
      })
    ).toBe("");
  });
});
