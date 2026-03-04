import { describe, expect, test } from "vitest";
import { deepMerge, isRecord, mergeStorefrontCopy } from "@/lib/store-experience/merge";
import { mapStoreExperienceContentRow } from "@/lib/store-experience/content";

describe("store experience merge helpers", () => {
  test("isRecord guards plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("nope")).toBe(false);
  });

  test("deepMerge merges nested objects with right precedence", () => {
    const merged = deepMerge(
      {
        home: { title: "Original", subtitle: "Keep" },
        footer: { label: "Footer" }
      },
      {
        home: { title: "Override" },
        cart: { title: "Cart" }
      }
    );

    expect(merged).toEqual({
      home: { title: "Override", subtitle: "Keep" },
      footer: { label: "Footer" },
      cart: { title: "Cart" }
    });
  });

  test("mergeStorefrontCopy merges ordered section overrides", () => {
    const merged = mergeStorefrontCopy(
      {
        home: { title: "Base", subtitle: "Base sub" },
        cart: { title: "Base cart" }
      },
      [
        { home: { subtitle: "Home override" } },
        { cart: { title: "Cart override" } },
        { home: { title: "Final home title" } }
      ]
    );

    expect(merged).toEqual({
      home: { title: "Final home title", subtitle: "Home override" },
      cart: { title: "Cart override" }
    });
  });
});

describe("store experience row mapping", () => {
  test("returns defaults when row is missing", () => {
    expect(mapStoreExperienceContentRow(null)).toEqual({
      home: {},
      productsPage: {},
      aboutPage: {},
      policiesPage: {},
      cartPage: {},
      orderSummaryPage: {},
      emails: {}
    });
  });

  test("maps row json columns to section keys", () => {
    const mapped = mapStoreExperienceContentRow({
      store_id: "store-1",
      home_json: { hero: { headline: "Home" } },
      products_page_json: { visibility: { showSearch: true } },
      about_page_json: { aboutArticleHtml: "<p>Hi</p>" },
      policies_page_json: { supportEmail: "help@example.com" },
      cart_page_json: { copy: { cart: { title: "Cart" } } },
      order_summary_page_json: { copy: { checkout: { title: "Checkout" } } },
      emails_json: { newsletterCapture: { enabled: true } }
    });

    expect(mapped.home).toEqual({ hero: { headline: "Home" } });
    expect(mapped.productsPage).toEqual({ visibility: { showSearch: true } });
    expect(mapped.aboutPage).toEqual({ aboutArticleHtml: "<p>Hi</p>" });
    expect(mapped.policiesPage).toEqual({ supportEmail: "help@example.com" });
    expect(mapped.cartPage).toEqual({ copy: { cart: { title: "Cart" } } });
    expect(mapped.orderSummaryPage).toEqual({ copy: { checkout: { title: "Checkout" } } });
    expect(mapped.emails).toEqual({ newsletterCapture: { enabled: true } });
  });
});

