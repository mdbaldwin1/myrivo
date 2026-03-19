# Reviews Test Matrix

## Objective
Track automated coverage for critical review workflows across APIs, moderation, and operational telemetry.

## Backend/API Coverage
- `apps/web/tests/review-abuse.test.ts`
  - abuse heuristics, rate-limit helpers, fingerprinting
- `apps/web/tests/review-media.test.ts`
  - media path/limits/dimensions helpers
- `apps/web/tests/reviews-dashboard-filter.test.ts`
  - dashboard media filtering behavior
- `apps/web/tests/reviews-health.test.ts`
  - queue latency summary calculations for health metrics
- `apps/web/tests/dashboard-review-moderation-route.test.ts`
  - owner moderation transition behavior and validation
- `apps/web/tests/dashboard-review-response-route.test.ts`
  - owner response constraints and upsert flow

## UI/Workflow Coverage
- Storefront reviews module behavior is covered by integration-level route/helper tests and regression checks for submission/read paths.
- Owner dashboard moderation workspace:
  - filter/query behavior covered via API + helper tests
  - moderation actions and response routes covered via route tests

## Permission/Routing Coverage
- Store-scoped owner moderation APIs covered by bundle resolution and store-id scoped queries.

## Regression Focus
- Notification routing tied to moderation/response remains covered by route tests asserting side-effect calls.
- Route consistency remains enforced in CI by `assert-dashboard-route-consistency.mjs`.

## Remaining Gaps (Planned)
- Full browser-level UI interaction tests for moderation flyout and bulk actions.
- End-to-end verification for multi-store ownership edge cases in moderation flows.
