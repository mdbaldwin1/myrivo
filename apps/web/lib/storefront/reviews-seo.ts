type ReviewSummary = {
  reviewCount: number;
  averageRating: number;
};

type ReviewItem = {
  rating: number;
  title: string | null;
  body: string | null;
  reviewerName: string | null;
  createdAt: string;
};

type ReviewSeoConfig = {
  minReviewCount: number;
  maxRecentReviews: number;
};

function parsePositiveInteger(raw: string | undefined, fallback: number) {
  if (!raw) {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) {
    return fallback;
  }
  return value;
}

function sanitizeText(value: string | null | undefined, maxLength: number) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function sanitizeRating(rating: number) {
  const normalized = Math.trunc(rating);
  if (!Number.isFinite(normalized)) {
    return 5;
  }
  return Math.min(5, Math.max(1, normalized));
}

function mapReviewToSchema(review: ReviewItem) {
  const author = sanitizeText(review.reviewerName, 120) ?? "Customer";
  const body = sanitizeText(review.body, 2000);
  const title = sanitizeText(review.title, 120);

  return {
    "@type": "Review",
    author: {
      "@type": "Person",
      name: author
    },
    datePublished: review.createdAt,
    reviewRating: {
      "@type": "Rating",
      ratingValue: sanitizeRating(review.rating),
      bestRating: 5,
      worstRating: 1
    },
    name: title ?? undefined,
    reviewBody: body ?? undefined
  };
}

export function resolveStorefrontReviewSeoConfig(env = process.env): ReviewSeoConfig {
  return {
    minReviewCount: parsePositiveInteger(env.STOREFRONT_REVIEW_SCHEMA_MIN_COUNT, 1),
    maxRecentReviews: Math.min(10, parsePositiveInteger(env.STOREFRONT_REVIEW_SCHEMA_MAX_RECENT, 3))
  };
}

export function buildAggregateRatingSchema(summary: ReviewSummary, minReviewCount: number) {
  if (summary.reviewCount < minReviewCount || summary.reviewCount < 1) {
    return undefined;
  }

  return {
    "@type": "AggregateRating",
    ratingValue: Number(summary.averageRating.toFixed(2)),
    ratingCount: summary.reviewCount,
    reviewCount: summary.reviewCount,
    bestRating: 5,
    worstRating: 1
  };
}

export function buildReviewSchemaList(reviews: ReviewItem[], maxRecentReviews: number) {
  return reviews.slice(0, Math.max(0, maxRecentReviews)).map(mapReviewToSchema);
}

