import { describe, expect, test } from "vitest";
import { resolveHeaderNavLinks, resolveFooterNavLinks } from "@/lib/storefront/navigation";
import { DEFAULT_STOREFRONT_COPY } from "@/lib/storefront/copy";
import { DEFAULT_STOREFRONT_THEME_CONFIG } from "@/lib/theme/storefront-theme";

describe("storefront navigation helpers", () => {
  test("appends store query parameter when store slug is provided", () => {
    const links = resolveHeaderNavLinks(DEFAULT_STOREFRONT_THEME_CONFIG, DEFAULT_STOREFRONT_COPY, "sister-shop");
    expect(links.some((link) => link.href.includes("store=sister-shop"))).toBe(true);
  });

  test("keeps plain links when store slug is absent", () => {
    const links = resolveFooterNavLinks(DEFAULT_STOREFRONT_THEME_CONFIG, DEFAULT_STOREFRONT_COPY);
    expect(links.every((link) => !link.href.includes("store="))).toBe(true);
  });
});
