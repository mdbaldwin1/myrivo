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

  test("validates file-backed schema and unique slugs", () => {
    const slugs = new Set<string>();
    for (const doc of OWNER_DOCS) {
      expect(doc.slug.length).toBeGreaterThan(0);
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.summary.length).toBeGreaterThan(0);
      expect(DOC_CATEGORY_ORDER).toContain(doc.category);
      expect(doc.owner.length).toBeGreaterThan(0);
      expect(["Monthly", "Quarterly", "Semiannual"]).toContain(doc.reviewCadence);
      expect(doc.reviewBy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(doc.reviewByLabel.length).toBeGreaterThan(0);
      expect(typeof doc.isReviewOverdue).toBe("boolean");
      expect(doc.sections.length).toBeGreaterThan(0);
      expect(slugs.has(doc.slug)).toBe(false);
      slugs.add(doc.slug);

      for (const section of doc.sections) {
        expect(section.heading.length).toBeGreaterThan(0);
        expect(section.paragraphs.length + (section.bullets?.length ?? 0)).toBeGreaterThan(0);
      }
    }
  });

  test("doc detail static params are generated from file docs", async () => {
    const detailPage = await import("@/app/docs/[slug]/page");
    const params = await detailPage.generateStaticParams();
    const slugs = params.map((entry) => entry.slug).sort();
    const ownerSlugs = OWNER_DOCS.map((doc) => doc.slug).sort();
    expect(slugs).toEqual(ownerSlugs);
  });
});
