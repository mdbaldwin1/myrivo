import { describe, expect, test } from "vitest";
import { getStorefrontButtonRadiusClass, getStorefrontCardStyleClass, getStorefrontRadiusClass } from "@/lib/storefront/appearance";

describe("storefront appearance helpers", () => {
  test("maps corner radius settings to shared classes", () => {
    expect(getStorefrontRadiusClass("soft")).toBe("rounded-2xl");
    expect(getStorefrontRadiusClass("rounded")).toBe("rounded-xl");
    expect(getStorefrontRadiusClass("sharp")).toBe("rounded-none");
    expect(getStorefrontButtonRadiusClass("sharp")).toBe("!rounded-none");
  });

  test("maps card style settings to shared surface classes", () => {
    expect(getStorefrontCardStyleClass("solid")).toContain("border border-border");
    expect(getStorefrontCardStyleClass("outline")).toContain("border-2");
    expect(getStorefrontCardStyleClass("elevated")).toContain("shadow-[0_10px_28px_rgba(var(--storefront-primary-rgb),0.18)]");
    expect(getStorefrontCardStyleClass("integrated")).toBe("border-0 bg-transparent shadow-none");
  });
});
