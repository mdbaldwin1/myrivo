# Reviews Rich Results Validation

This checklist validates structured data emitted by storefront routes after review SEO rollout.

## Scope
- Store home route: `/s/{storeSlug}` and canonical equivalents
- Product detail route: `/products/{productSlug}?store={storeSlug}` and canonical equivalents

## Preconditions
- Store has at least one published review for store-level schema checks.
- Product has at least one published review for product-level schema checks.
- Optional threshold override:
  - `STOREFRONT_REVIEW_SCHEMA_MIN_COUNT` controls minimum `reviewCount` needed before emitting `aggregateRating`.
  - `STOREFRONT_REVIEW_SCHEMA_MAX_RECENT` controls max review entries included in JSON-LD.

## Validation Steps
1. Open the page and inspect rendered `<script type="application/ld+json">` payloads.
2. Confirm only `published` reviews are represented in `review` arrays.
3. Confirm `aggregateRating` is omitted when total published reviews are below configured minimum.
4. Confirm `aggregateRating.ratingCount` and `reviewCount` match published counts.
5. Validate URLs with Google Rich Results Test:
   - https://search.google.com/test/rich-results
6. Validate schema graph with Schema Markup Validator:
   - https://validator.schema.org/

## Expected Output
- Product route emits `Product` schema with `aggregateRating` and recent `Review` entries when threshold is met.
- Store route emits `LocalBusiness` schema with `aggregateRating` and recent `Review` entries when threshold is met.
- Unpublished/rejected reviews never appear in JSON-LD payloads.
