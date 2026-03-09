import { describe, expect, test } from "vitest";
import { DOC_CATEGORY_ORDER, OWNER_DOCS, getOwnerDocBySlug, getOwnerDocsByCategory } from "@/lib/docs/content";

describe("owner docs content", () => {
  test("returns docs grouped in stable category order", () => {
    const groups = getOwnerDocsByCategory();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.map((entry) => entry.category)).toEqual(DOC_CATEGORY_ORDER.filter((category) => groups.some((entry) => entry.category === category)));
  });

  test("resolves docs by slug", () => {
    expect(OWNER_DOCS.length).toBeGreaterThan(0);
    const firstDoc = OWNER_DOCS[0];
    if (!firstDoc) {
      throw new Error("Expected at least one owner doc.");
    }
    expect(getOwnerDocBySlug(firstDoc.slug)?.title).toBe(firstDoc.title);
    expect(getOwnerDocBySlug("missing-doc")).toBeNull();
  });
});
