import { describe, expect, test } from "vitest";
import { buildReviewComplianceMetadata, readReviewIncentiveDisclosure } from "@/lib/reviews/compliance";

describe("review compliance helpers", () => {
  test("stores incentive disclosure metadata when a review is incentivized", () => {
    const metadata = buildReviewComplianceMetadata(
      { fingerprint: "abc123" },
      {
        incentivized: true,
        incentiveDescription: "Received a sample in exchange for an honest review"
      }
    );

    expect(metadata).toMatchObject({
      fingerprint: "abc123",
      incentive_disclosure: {
        disclosed: true,
        description: "Received a sample in exchange for an honest review"
      }
    });
  });

  test("reads incentive disclosure safely from review metadata", () => {
    expect(
      readReviewIncentiveDisclosure({
        incentive_disclosure: {
          disclosed: true,
          description: "Discounted order"
        }
      })
    ).toEqual({
      disclosed: true,
      description: "Discounted order"
    });

    expect(readReviewIncentiveDisclosure(null)).toEqual({
      disclosed: false,
      description: null
    });
  });
});
