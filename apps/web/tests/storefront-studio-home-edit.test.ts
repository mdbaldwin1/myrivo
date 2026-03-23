import { describe, expect, test } from "vitest";
import { setStorefrontStudioHomeField, updateStorefrontStudioHomeContentBlock } from "@/lib/storefront/studio-home-edit";

describe("storefront studio home edit helpers", () => {
  test("writes nested home fields by path", () => {
    const next = setStorefrontStudioHomeField({}, "copy.home.contentBlocksHeading", "Why shoppers come back");

    expect(next).toEqual({
      copy: {
        home: {
          contentBlocksHeading: "Why shoppers come back"
        }
      }
    });
  });

  test("writes nested home fields without clobbering sibling values", () => {
    const next = setStorefrontStudioHomeField(
      {
        copy: {
          home: {
            contentBlocksHeading: "Existing heading",
            featuredProductsHeading: "Featured picks"
          }
        }
      },
      "copy.home.contentBlocksHeading",
      "Why shoppers come back"
    );

    expect(next).toEqual({
      copy: {
        home: {
          contentBlocksHeading: "Why shoppers come back",
          featuredProductsHeading: "Featured picks"
        }
      }
    });
  });

  test("updates a targeted home content block without mutating siblings", () => {
    const next = updateStorefrontStudioHomeContentBlock(
      {
        contentBlocks: [
          { id: "one", title: "First", body: "One" },
          { id: "two", title: "Second", body: "Two" }
        ]
      },
      "two",
      { title: "Updated second" }
    );

    expect(next).toEqual({
      contentBlocks: [
        { id: "one", title: "First", body: "One" },
        { id: "two", title: "Updated second", body: "Two" }
      ]
    });
  });
});
