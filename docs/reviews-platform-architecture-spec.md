# Reviews Platform Architecture Spec

## 1. Objective
Build a trust-safe reviews platform supporting:
- Store reviews (overall merchant experience)
- Product reviews (item-specific experience)
- Multiple images per review
- Moderation workflow with owner responses
- SEO-safe aggregate/rich result output

This spec is the canonical source for the initial implementation scope in epic `myrivo-29`.

## 2. Scope and Non-Goals
### In Scope
- Customer submission of store/product reviews
- Verified purchase inference from orders
- Multi-image attachment pipeline
- Moderation states and transitions
- Public review read APIs and owner moderation APIs
- Owner responses to published reviews
- Notifications and SEO integration

### Non-Goals (Initial Release)
- Third-party review imports/syndication
- Public reviewer profile pages
- AI-assisted moderation/replies

## 3. Domain Model
### 3.1 Entities
- `reviews`
  - `id` (uuid)
  - `store_id` (uuid, required)
  - `product_id` (uuid, nullable for store reviews)
  - `order_id` (uuid, nullable)
  - `review_type` (`store` | `product`)
  - `reviewer_user_id` (uuid, nullable)
  - `reviewer_email` (text, required for anti-abuse and dedupe)
  - `reviewer_name` (text, nullable)
  - `rating` (int, 1..5)
  - `title` (text, nullable)
  - `body` (text, nullable)
  - `verified_purchase` (bool)
  - `status` (`pending` | `published` | `rejected`)
  - `moderation_reason` (text, nullable)
  - `metadata` (jsonb)
  - `created_at`, `updated_at`, `published_at` (timestamptz)

- `review_media`
  - `id` (uuid)
  - `review_id` (uuid)
  - `storage_path` (text)
  - `public_url` (text)
  - `mime_type` (text)
  - `size_bytes` (int)
  - `width` (int, nullable)
  - `height` (int, nullable)
  - `sort_order` (int)
  - `status` (`active` | `hidden` | `removed`)
  - `moderation_reason` (text, nullable)
  - `created_at`, `updated_at`

- `review_responses`
  - `id` (uuid)
  - `review_id` (uuid unique)
  - `store_id` (uuid)
  - `author_user_id` (uuid)
  - `body` (text)
  - `created_at`, `updated_at`

- `review_aggregate_snapshots` (optional denormalized cache)
  - keyed by (`store_id`, `product_id` nullable)
  - `review_count`, `average_rating`, `rating_1_count`...`rating_5_count`
  - `updated_at`

### 3.2 Constraints
- Exactly one of:
  - `review_type=store` => `product_id IS NULL`
  - `review_type=product` => `product_id IS NOT NULL`
- `rating` in `[1,5]`
- One response per review (`review_responses.review_id` unique)
- Deduplication policy (initial):
  - unique logical key per (`store_id`, `product_id`, `order_id`, normalized_reviewer_email`)

## 4. Verification and Trust Rules
- `verified_purchase=true` only if submission can be matched to an order in same store where:
  - order email matches reviewer email, and
  - for product reviews: product exists on that order.
- If no order match, allow submission but mark unverified.
- Storefront badges only display `Verified purchase` for true values.

## 5. Moderation State Machine
### 5.1 Review States
- `pending`: default for new submissions
- `published`: visible publicly and included in aggregates/SEO
- `rejected`: hidden publicly; excluded from aggregates/SEO

### 5.2 Transitions
Allowed:
- `pending -> published`
- `pending -> rejected`
- `rejected -> published` (restore)
- `published -> rejected` (takedown)

Disallowed:
- direct hard delete from owner UI (admin-only maintenance path)
- any transition without audit metadata (actor + reason for reject/takedown)

### 5.3 Media States
- `active`: publicly visible when parent review is published
- `hidden`: not publicly visible but retained
- `removed`: removed from UI, may retain metadata for audit

### 5.4 Response Rules
- Owner responses allowed only when parent review is `published`.
- If parent becomes `rejected`, response is hidden from public read APIs.

## 6. Authorization and Permission Matrix
### Customer / Anonymous
- Create review: allowed (subject to rate limits/validation)
- Upload media: allowed via signed upload flow
- Read published reviews: allowed
- Moderate / respond: denied

### Store owner/admin/staff (store-scoped)
- Read moderation queue for own store: allowed
- Approve/reject/restore own store reviews: allowed (policy-controlled by role)
- Hide/remove review media in own store: allowed
- Create/update/delete owner response for own store: allowed

### Platform support/admin
- Global moderation and override actions: allowed

## 7. API Contracts
## 7.1 Customer Submission
- `POST /api/reviews`
  - payload: `storeSlug`, `reviewType`, `productId?`, `orderId?`, `rating`, `title?`, `body?`, `reviewerName?`, `reviewerEmail`, `media[]`
  - returns: normalized review resource (`status`, `verifiedPurchase`, `media[]`)

- `POST /api/reviews/media/upload-url`
  - payload: `mimeType`, `sizeBytes`, `reviewDraftId`
  - returns: signed upload URL + `storagePath`

- `POST /api/reviews/media/complete`
  - payload: `storagePath`, `width?`, `height?`, `sortOrder`
  - returns: staged media reference

## 7.2 Public Read
- `GET /api/reviews/store/:storeSlug`
  - query: `rating?`, `verifiedOnly?`, `hasMedia?`, `sort?`, `cursor?`, `limit?`
  - returns: `items[]`, `nextCursor`, `summary`

- `GET /api/reviews/product/:productId`
  - query same as above
  - returns same shape

## 7.3 Owner Moderation
- `GET /api/dashboard/reviews`
  - query: `storeId`, `status`, `rating?`, `productId?`, `hasMedia?`, `cursor?`

- `PATCH /api/dashboard/reviews/:reviewId/moderation`
  - payload: `action` (`publish` | `reject` | `restore`), `reason?`

- `PATCH /api/dashboard/reviews/:reviewId/media/:mediaId`
  - payload: `action` (`hide` | `remove` | `restore`), `reason?`

- `PUT /api/dashboard/reviews/:reviewId/response`
  - payload: `body`

- `DELETE /api/dashboard/reviews/:reviewId/response`

## 8. Validation and Limits
- Rating required, integer 1..5
- Title max 120 chars
- Body max 5000 chars
- Media constraints (initial defaults):
  - max images per review: 8
  - max file size per image: 8 MB
  - allowed types: jpeg/png/webp
  - max dimensions: 6000x6000
- Text and metadata sanitized server-side

## 9. Anti-Abuse Controls
- Rate limit by IP + reviewer identity + store scope
- Deduplicate repeated payloads in short windows
- Blocklist/profanity heuristic flagging (`pending` + moderation_reason)
- Audit trail for moderation and abuse decisions

## 10. Read Model and Performance Targets
- Public read endpoints must respond p95 < 300ms for first page in normal load
- Moderation queue p95 < 400ms for first page
- Aggregates should be computed via indexed query or snapshot table
- Sort stability under pagination guaranteed by `(created_at, id)` tie-breakers

## 11. Notifications Integration
Events:
- `review.created.owner`
- `review.low_rating.owner`
- `review.responded.customer` (if account-linked and enabled)
- `review.moderated.customer` (optional policy)

All owner events default to in-app; email per preference rules.

## 12. SEO and Structured Data Rules
- Include only `published` reviews in structured data
- Aggregate ratings emitted only when `review_count > 0`
- Product pages emit `Product` + `aggregateRating` + subset of recent `Review`
- Store pages emit org/store aggregate rating schema where applicable

## 13. Audit and Data Retention
- Persist moderation actor, action, reason, timestamp
- Media removal should preserve audit metadata
- Soft-delete strategy preferred for reviews; hard-delete admin-only path

## 14. Migration and Backward Compatibility
- No legacy review system currently assumed
- New tables introduced with no destructive migration
- Optional snapshot backfill script introduced in rollout bead

## 15. Acceptance Mapping to Bead Plan
- `myrivo-29.2` implements schema and RLS from sections 3, 5, 6
- `myrivo-29.3` implements media pipeline from section 7.1 and limits in section 8
- `myrivo-29.4` implements submission and verification from sections 4, 7.1, 9
- `myrivo-29.5` implements public read model from sections 7.2 and 10
- `myrivo-29.6` implements moderation and responses from sections 5, 7.3
- `myrivo-29.9` and `myrivo-29.10` implement sections 11 and 12
