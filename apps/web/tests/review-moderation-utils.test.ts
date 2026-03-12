import { describe, expect, test } from "vitest";
import { getReviewMedia, getReviewResponses, normalizeReviewCollection, normalizeReviewNestedArrays } from "@/lib/reviews/moderation";

describe("review moderation helpers", () => {
  test("normalizes nullable review media and responses to empty arrays", () => {
    const normalized = normalizeReviewNestedArrays({
      id: "review-1",
      review_media: null,
      review_responses: null
    });

    expect(normalized.review_media).toEqual([]);
    expect(normalized.review_responses).toEqual([]);
  });

  test("normalizes collections and exposes safe nested accessors", () => {
    const [review] = normalizeReviewCollection([
      {
        id: "review-1",
        review_media: null,
        review_responses: [{ id: "response-1", body: "Thanks" }]
      }
    ]);

    expect(getReviewMedia(review)).toEqual([]);
    expect(getReviewResponses(review)).toEqual([{ id: "response-1", body: "Thanks" }]);
    expect(getReviewMedia(null)).toEqual([]);
    expect(getReviewResponses(null)).toEqual([]);
  });
});
