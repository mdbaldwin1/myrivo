import { describe, expect, test } from "vitest";
import { getStorefrontPageShellClass, getStorefrontPageSpacingClass, getStorefrontPageWidthClass } from "@/lib/storefront/layout";

describe("storefront layout helpers", () => {
  test("keeps the configured page width mapping", () => {
    expect(getStorefrontPageWidthClass("narrow")).toBe("max-w-5xl");
    expect(getStorefrontPageWidthClass("standard")).toBe("max-w-6xl");
    expect(getStorefrontPageWidthClass("wide")).toBe("max-w-7xl");
  });

  test("uses tighter mobile-first spacing while preserving larger-screen rhythm", () => {
    expect(getStorefrontPageSpacingClass("compact")).toContain("px-4");
    expect(getStorefrontPageSpacingClass("comfortable")).toContain("sm:px-6");
    expect(getStorefrontPageSpacingClass("airy")).toContain("lg:py-12");
  });

  test("builds a combined page shell class from width and spacing settings", () => {
    const shellClass = getStorefrontPageShellClass("standard", "comfortable");
    expect(shellClass).toContain("mx-auto w-full");
    expect(shellClass).toContain("max-w-6xl");
    expect(shellClass).toContain("px-4");
  });
});
