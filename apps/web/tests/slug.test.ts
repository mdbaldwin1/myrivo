import { describe, expect, test } from "vitest";
import { isValidStoreSlug, normalizeStoreSlug } from "@/lib/stores/slug";

describe("store slug utilities", () => {
  test("normalizes names into URL-safe slugs", () => {
    expect(normalizeStoreSlug("Sunset Mercantile !!")).toBe("sunset-mercantile");
  });

  test("validates slug length and charset", () => {
    expect(isValidStoreSlug("sunset-shop")).toBe(true);
    expect(isValidStoreSlug("No")).toBe(false);
    expect(isValidStoreSlug("bad_slug")).toBe(false);
  });
});
