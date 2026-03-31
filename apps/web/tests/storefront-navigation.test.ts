import { describe, expect, test } from "vitest";
import { resolveHeaderNavLinks, resolveFooterNavLinks } from "@/lib/storefront/navigation";
import { DEFAULT_STOREFRONT_COPY } from "@/lib/storefront/copy";
import { DEFAULT_STOREFRONT_THEME_CONFIG } from "@/lib/theme/storefront-theme";

describe("storefront navigation helpers", () => {
  test("uses the storefront home path when store slug is provided", () => {
    const links = resolveHeaderNavLinks(DEFAULT_STOREFRONT_THEME_CONFIG, DEFAULT_STOREFRONT_COPY, "sister-shop");
    expect(links.find((link) => link.label === DEFAULT_STOREFRONT_COPY.nav.home)?.href).toBe("/s/sister-shop");
    expect(links.some((link) => link.href.includes("store=sister-shop"))).toBe(false);
  });

  test("uses clean root paths when a custom-domain route base is provided", () => {
    const links = resolveHeaderNavLinks(DEFAULT_STOREFRONT_THEME_CONFIG, DEFAULT_STOREFRONT_COPY, "sister-shop", "");
    expect(links.find((link) => link.label === DEFAULT_STOREFRONT_COPY.nav.home)?.href).toBe("/");
    expect(links.find((link) => link.label === DEFAULT_STOREFRONT_COPY.nav.products)?.href).toBe("/products");
  });

  test("keeps plain links when store slug is absent", () => {
    const links = resolveFooterNavLinks(DEFAULT_STOREFRONT_THEME_CONFIG, DEFAULT_STOREFRONT_COPY);
    expect(links.every((link) => !link.href.includes("store="))).toBe(true);
  });

  test("keeps the root home path when no store slug is present", () => {
    const links = resolveHeaderNavLinks(DEFAULT_STOREFRONT_THEME_CONFIG, DEFAULT_STOREFRONT_COPY);
    expect(links.find((link) => link.label === DEFAULT_STOREFRONT_COPY.nav.home)?.href).toBe("/");
  });
});
