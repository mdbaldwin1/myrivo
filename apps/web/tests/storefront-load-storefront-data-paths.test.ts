import { describe, expect, test } from "vitest";
import { getBoolean, getNumber, getString } from "@/lib/storefront/load-storefront-data";

describe("loadStorefrontData nested path helpers", () => {
  test("reads nested boolean/string/number values by dotted path", () => {
    const source = {
      reviews: {
        enabled: false,
        defaultSort: "highest",
        itemsPerPage: 24
      }
    };

    expect(getBoolean(source, "reviews.enabled", true)).toBe(false);
    expect(getString(source, "reviews.defaultSort", "newest")).toBe("highest");
    expect(getNumber(source, "reviews.itemsPerPage", 10)).toBe(24);
  });

  test("falls back when any part of the dotted path is missing", () => {
    const source = {
      reviews: {}
    };

    expect(getBoolean(source, "reviews.showSummary", true)).toBe(true);
    expect(getString(source, "reviews.defaultSort", "newest")).toBe("newest");
    expect(getNumber(source, "reviews.itemsPerPage", 10)).toBe(10);
  });

  test("falls back when an intermediate path segment is not an object", () => {
    const source = {
      reviews: {
        summary: "not-an-object"
      }
    };

    expect(getBoolean(source, "reviews.summary.enabled", true)).toBe(true);
    expect(getString(source, "reviews.summary.label", "Summary")).toBe("Summary");
    expect(getNumber(source, "reviews.summary.itemsPerPage", 12)).toBe(12);
  });
});
