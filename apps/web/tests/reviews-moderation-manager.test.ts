import { describe, expect, test } from "vitest";
import { applyReviewModerationToQueue, type ReviewRow } from "@/components/dashboard/reviews-moderation-manager";

const baseReview: ReviewRow = {
  id: "review-1",
  product_id: null,
  reviewer_name: "Test Reviewer",
  reviewer_email: "test@example.com",
  rating: 5,
  title: "Great",
  body: "Loved it",
  verified_purchase: false,
  status: "pending",
  moderation_reason: null,
  metadata: null,
  created_at: "2026-03-31T00:00:00.000Z",
  review_media: [],
  review_responses: []
};

describe("applyReviewModerationToQueue", () => {
  test("removes a rejected review from the pending queue", () => {
    const result = applyReviewModerationToQueue([baseReview], baseReview.id, "reject", "pending", "Policy issue");

    expect(result).toEqual([]);
  });

  test("keeps the updated review in the all queue", () => {
    const result = applyReviewModerationToQueue([baseReview], baseReview.id, "reject", "all", "Policy issue");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: baseReview.id,
      status: "rejected",
      moderation_reason: "Policy issue"
    });
  });
});
