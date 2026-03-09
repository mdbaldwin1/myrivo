import { describe, expect, test } from "vitest";
import { buildAggregateRatingSchema, buildReviewSchemaList, resolveStorefrontReviewSeoConfig } from "@/lib/storefront/reviews-seo";

describe("storefront review seo helpers", () => {
  test("returns aggregate rating only when threshold is met", () => {
    expect(buildAggregateRatingSchema({ reviewCount: 0, averageRating: 5 }, 1)).toBeUndefined();
    expect(buildAggregateRatingSchema({ reviewCount: 2, averageRating: 4.256 }, 3)).toBeUndefined();

    expect(buildAggregateRatingSchema({ reviewCount: 3, averageRating: 4.256 }, 3)).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.26,
      ratingCount: 3,
      reviewCount: 3,
      bestRating: 5,
      worstRating: 1
    });
  });

  test("maps and caps review schema list", () => {
    const reviews = buildReviewSchemaList(
      [
        {
          rating: 5,
          title: "Amazing product",
          body: "Works very well for my skin.",
          reviewerName: "Jane",
          createdAt: "2026-03-09T12:00:00Z"
        },
        {
          rating: 3,
          title: null,
          body: "Solid",
          reviewerName: null,
          createdAt: "2026-03-08T12:00:00Z"
        }
      ],
      1
    );

    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({
      "@type": "Review",
      author: { "@type": "Person", name: "Jane" },
      reviewRating: { "@type": "Rating", ratingValue: 5, bestRating: 5, worstRating: 1 },
      datePublished: "2026-03-09T12:00:00Z"
    });
  });

  test("resolves configurable review schema guardrails", () => {
    const config = resolveStorefrontReviewSeoConfig({
      ...process.env,
      STOREFRONT_REVIEW_SCHEMA_MIN_COUNT: "7",
      STOREFRONT_REVIEW_SCHEMA_MAX_RECENT: "25"
    });

    expect(config).toEqual({
      minReviewCount: 7,
      maxRecentReviews: 10
    });
  });
});

