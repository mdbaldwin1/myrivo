import { describe, expect, test } from "vitest";
import {
  getStorefrontStudioSurface,
  normalizeStorefrontStudioSurface
} from "@/lib/store-editor/storefront-studio";

describe("storefront studio route metadata", () => {
  test("normalizes invalid surface ids to home", () => {
    expect(normalizeStorefrontStudioSurface("unknown-surface")).toBe("home");
  });

  test("builds preview routes for supported surfaces", () => {
    expect(getStorefrontStudioSurface("about").previewHref("olive-mercantile")).toBe("/s/olive-mercantile/about");
    expect(getStorefrontStudioSurface("policies").previewHref("olive-mercantile")).toBe("/policies?store=olive-mercantile");
    expect(getStorefrontStudioSurface("cart").previewHref("olive-mercantile")).toBe("/cart?store=olive-mercantile");
  });
});
