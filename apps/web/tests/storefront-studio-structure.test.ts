import { describe, expect, test } from "vitest";
import {
  moveAboutSection,
  moveHomeContentBlock,
  movePoliciesFaq,
  removeAboutSection,
  removeHomeContentBlock,
  removePoliciesFaq,
  updateAboutSection,
  updateHomeContentBlock,
  updatePoliciesFaq
} from "@/lib/storefront/studio-structure";

describe("storefront studio structure helpers", () => {
  test("updates home content block CTA fields", () => {
    const next = updateHomeContentBlock(
      {
        contentBlocks: [{ id: "block-1", title: "Title", body: "Body", ctaLabel: "", ctaUrl: "", sortOrder: 0, isActive: true }]
      },
      "block-1",
      { ctaLabel: "Shop now", ctaUrl: "/products" }
    );

    expect(next).toEqual({
      contentBlocks: [{ id: "block-1", title: "Title", body: "Body", eyebrow: "", ctaLabel: "Shop now", ctaUrl: "/products", sortOrder: 0, isActive: true }]
    });
  });

  test("reorders and removes home content blocks with normalized sort order", () => {
    const moved = moveHomeContentBlock(
      {
        contentBlocks: [
          { id: "one", title: "One", body: "", eyebrow: "", sortOrder: 0, ctaLabel: "", ctaUrl: "", isActive: true },
          { id: "two", title: "Two", body: "", eyebrow: "", sortOrder: 1, ctaLabel: "", ctaUrl: "", isActive: true }
        ]
      },
      "two",
      "up"
    );

    expect(moved).toEqual({
      contentBlocks: [
        { id: "two", title: "Two", body: "", eyebrow: "", sortOrder: 0, ctaLabel: "", ctaUrl: "", isActive: true },
        { id: "one", title: "One", body: "", eyebrow: "", sortOrder: 1, ctaLabel: "", ctaUrl: "", isActive: true }
      ]
    });

    expect(removeHomeContentBlock(moved, "two")).toEqual({
      contentBlocks: [{ id: "one", title: "One", body: "", eyebrow: "", sortOrder: 0, ctaLabel: "", ctaUrl: "", isActive: true }]
    });
  });

  test("updates and reorders about sections", () => {
    const updated = updateAboutSection(
      {
        aboutSections: [
          { id: "first", title: "First", body: "Body", imageUrl: "", layout: "image_right" },
          { id: "second", title: "Second", body: "Body", imageUrl: "", layout: "full" }
        ]
      },
      "first",
      { layout: "image_left", imageUrl: "/image.png" }
    );

    expect(updated).toEqual({
      aboutSections: [
        { id: "first", title: "First", body: "Body", imageUrl: "/image.png", layout: "image_left" },
        { id: "second", title: "Second", body: "Body", imageUrl: "", layout: "full" }
      ]
    });

    expect(moveAboutSection(updated, "second", "up")).toEqual({
      aboutSections: [
        { id: "second", title: "Second", body: "Body", imageUrl: "", layout: "full" },
        { id: "first", title: "First", body: "Body", imageUrl: "/image.png", layout: "image_left" }
      ]
    });

    expect(removeAboutSection(updated, "second")).toEqual({
      aboutSections: [{ id: "first", title: "First", body: "Body", imageUrl: "/image.png", layout: "image_left" }]
    });
  });

  test("updates and removes policy faqs with normalized sort order", () => {
    const updated = updatePoliciesFaq(
      {
        policyFaqs: [
          { id: "faq-1", question: "Q1", answer: "A1", sortOrder: 0, isActive: true },
          { id: "faq-2", question: "Q2", answer: "A2", sortOrder: 1, isActive: true }
        ]
      },
      "faq-2",
      { isActive: false, answer: "Updated" }
    );

    expect(updated).toEqual({
      policyFaqs: [
        { id: "faq-1", question: "Q1", answer: "A1", sortOrder: 0, isActive: true },
        { id: "faq-2", question: "Q2", answer: "Updated", sortOrder: 1, isActive: false }
      ]
    });

    expect(removePoliciesFaq(updated, "faq-1")).toEqual({
      policyFaqs: [{ id: "faq-2", question: "Q2", answer: "Updated", sortOrder: 0, isActive: false }]
    });

    expect(movePoliciesFaq(updated, "faq-2", "up")).toEqual({
      policyFaqs: [
        { id: "faq-2", question: "Q2", answer: "Updated", sortOrder: 0, isActive: false },
        { id: "faq-1", question: "Q1", answer: "A1", sortOrder: 1, isActive: true }
      ]
    });
  });
});
