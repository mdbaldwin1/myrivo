export type ReviewRecordWithNestedArrays<TMedia, TResponse> = {
  review_media: TMedia[] | null;
  review_responses: TResponse[] | null;
};

export function normalizeReviewNestedArrays<TMedia, TResponse, TReview extends ReviewRecordWithNestedArrays<TMedia, TResponse>>(review: TReview): TReview {
  return {
    ...review,
    review_media: Array.isArray(review.review_media) ? review.review_media : [],
    review_responses: Array.isArray(review.review_responses) ? review.review_responses : []
  };
}

export function normalizeReviewCollection<TMedia, TResponse, TReview extends ReviewRecordWithNestedArrays<TMedia, TResponse>>(reviews: TReview[]) {
  return reviews.map((review) => normalizeReviewNestedArrays(review));
}

export function getReviewMedia<TMedia, TResponse>(review: ReviewRecordWithNestedArrays<TMedia, TResponse> | null | undefined) {
  return review?.review_media ?? [];
}

export function getReviewResponses<TMedia, TResponse>(review: ReviewRecordWithNestedArrays<TMedia, TResponse> | null | undefined) {
  return review?.review_responses ?? [];
}
