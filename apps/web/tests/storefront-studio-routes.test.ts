import { describe, expect, test } from "vitest";
import {
  buildStorefrontStudioSurfaceHref,
  getStorefrontStudioSurface,
  getStorefrontStudioSurfaceForHref,
  normalizeStorefrontStudioEditorTarget,
  normalizeStorefrontStudioSurface
} from "@/lib/store-editor/storefront-studio";

describe("storefront studio route metadata", () => {
  test("normalizes invalid surface ids to home", () => {
    expect(normalizeStorefrontStudioSurface("unknown-surface")).toBe("home");
  });

  test("normalizes supported editor targets and rejects deprecated values", () => {
    expect(normalizeStorefrontStudioEditorTarget("brand")).toBe("brand");
    expect(normalizeStorefrontStudioEditorTarget("productDetail")).toBe("productDetail");
    expect(normalizeStorefrontStudioEditorTarget("branding")).toBeNull();
    expect(normalizeStorefrontStudioEditorTarget("unknown")).toBeNull();
  });

  test("builds preview routes for supported surfaces", () => {
    expect(getStorefrontStudioSurface("about").previewHref("olive-mercantile")).toBe("/s/olive-mercantile/about");
    expect(getStorefrontStudioSurface("policies").previewHref("olive-mercantile")).toBe("/s/olive-mercantile/policies");
    expect(getStorefrontStudioSurface("cart").previewHref("olive-mercantile")).toBe("/s/olive-mercantile/cart");
  });

  test("builds canonical Studio URLs for surface navigation", () => {
    expect(buildStorefrontStudioSurfaceHref("/dashboard/stores/olive-mercantile/storefront-studio", new URLSearchParams(""), "about")).toBe(
      "/dashboard/stores/olive-mercantile/storefront-studio?surface=about"
    );
    expect(
      buildStorefrontStudioSurfaceHref(
        "/dashboard/stores/olive-mercantile/storefront-studio",
        new URLSearchParams("surface=products&tab=preview"),
        "home"
      )
    ).toBe("/dashboard/stores/olive-mercantile/storefront-studio?tab=preview");
  });

  test("maps storefront hrefs back to Studio surfaces", () => {
    expect(getStorefrontStudioSurfaceForHref("/products?store=olive-mercantile", "olive-mercantile")).toBe("products");
    expect(getStorefrontStudioSurfaceForHref("/s/olive-mercantile/about", "olive-mercantile")).toBe("about");
    expect(getStorefrontStudioSurfaceForHref("/checkout?store=olive-mercantile", "olive-mercantile")).toBe("orderSummary");
    expect(getStorefrontStudioSurfaceForHref("/s/olive-mercantile/cart", "olive-mercantile")).toBe("cart");
  });
});
