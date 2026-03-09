import { describe, expect, test } from "vitest";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";

describe("storefront theme style", () => {
  test("uses provided valid hex colors", () => {
    const style = buildStorefrontThemeStyle({ primaryColor: "#112233", accentColor: "#AABBCC" }) as Record<string, string>;
    expect(style["--storefront-primary"]).toBe("#112233");
    expect(style["--storefront-accent"]).toBe("#AABBCC");
  });

  test("falls back to defaults for invalid colors", () => {
    const style = buildStorefrontThemeStyle({ primaryColor: "blue", accentColor: "#123" }) as Record<string, string>;
    expect(style["--storefront-primary"]).toBe("#0F7B84");
    expect(style["--storefront-accent"]).toBe("#1AA3A8");
  });

  test("resolves safe defaults for invalid layout config", () => {
    const config = resolveStorefrontThemeConfig({ pageWidth: "giant", productGridColumns: 9, showContentBlocks: "yes" });
    expect(config.pageWidth).toBe("standard");
    expect(config.productGridColumns).toBe(2);
    expect(config.showContentBlocks).toBe(true);
  });

  test("includes extended color tokens in style output", () => {
    const style = buildStorefrontThemeStyle({
      primaryColor: "#112233",
      accentColor: "#AABBCC",
      themeConfig: {
        backgroundColor: "#010203",
        surfaceColor: "#FAFAFA",
        textColor: "#111111",
        primaryForegroundColor: "#F0F0F0",
        accentForegroundColor: "#101010"
      }
    }) as Record<string, string>;

    expect(style["--storefront-bg"]).toBe("#010203");
    expect(style["--storefront-surface"]).toBe("#FAFAFA");
    expect(style["--storefront-text"]).toBe("#111111");
    expect(style["--storefront-primary-foreground"]).toBe("#F0F0F0");
    expect(style["--storefront-accent-foreground"]).toBe("#101010");
  });

  test("auto-computes foreground tokens when explicit values are missing", () => {
    const style = buildStorefrontThemeStyle({
      primaryColor: "#F0E68C",
      accentColor: "#1C2A39"
    }) as Record<string, string>;

    expect(style["--storefront-primary-foreground"]).toBe("#FFFFFF");
    expect(style["--storefront-accent-foreground"]).toBe("#FFFFFF");
  });
});
