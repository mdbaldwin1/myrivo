# Reviews Rollout Runbook

## Goals
- Roll out reviews safely with a reversible gate.
- Backfill aggregate snapshots before broad traffic.
- Verify moderation, storefront, SEO schema, and notification behavior.

## Feature Gate Strategy
- `REVIEWS_ROLLOUT_STORE_SLUGS` (comma-separated store slugs, optional)
  - If set, reviews are enabled only for listed stores.
  - If empty, all stores are eligible.

## Rollout Phases
1. Phase 0 (dark launch):
   - Set `REVIEWS_ROLLOUT_STORE_SLUGS` to a tightly controlled pilot list or keep rollout isolated from public traffic by environment.
   - Deploy code and run backfill in dry-run mode.
2. Phase 1 (internal pilot):
   - Set `REVIEWS_ROLLOUT_STORE_SLUGS=pilot-store-slug`.
   - Execute smoke checklist below.
3. Phase 2 (expanded allowlist):
   - Add additional store slugs in batches.
   - Monitor moderation queue and upload errors.
4. Phase 3 (general availability):
   - Clear `REVIEWS_ROLLOUT_STORE_SLUGS`.
   - Reviews are available everywhere.

## Backfill Procedure
1. Dry run:
   - `node scripts/reviews-backfill-aggregate-snapshots.mjs --env-file=.env.local --dry-run`
2. Scoped write (single store optional):
   - `node scripts/reviews-backfill-aggregate-snapshots.mjs --env-file=.env.local --store-slug=at-home-apothecary`
3. Global write:
   - `node scripts/reviews-backfill-aggregate-snapshots.mjs --env-file=.env.local`
4. Optional prune stale rows:
   - `node scripts/reviews-backfill-aggregate-snapshots.mjs --env-file=.env.local --prune`

## Smoke Checklist
- Storefront home/product pages:
  - Reviews section visibility respects rollout gate.
  - New review submission succeeds for enabled stores and fails for disabled stores.
- Media upload flow:
  - Upload URL + complete + cleanup endpoints return expected responses.
- Moderation:
  - Owner can publish/reject pending review and response workflow still works.
- Notifications:
  - Owner low-rating and customer moderation/response notifications still route correctly.
- SEO:
  - Validate JSON-LD with [docs/reviews-rich-results-validation.md](./reviews-rich-results-validation.md).

## Post-Launch Verification
- Run:
  - `npm run -w @myrivo/web test -- review-feature-gating storefront-reviews-seo`
  - `npm run -w @myrivo/web typecheck`
  - `npm run -w @myrivo/web lint`
- Spot check:
  - `/api/platform/reviews/health`
  - a store owner's review moderation queue
  - `/dashboard/admin/audit` for `review_pipeline.upload_error`

## Rollback Strategy
1. Immediate containment:
   - Set `REVIEWS_ROLLOUT_STORE_SLUGS` to a safe allowlist and redeploy.
2. App rollback:
   - Re-deploy previous stable `main` commit if issue is code-level.
3. Data rollback:
   - Snapshot table only: rerun backfill with corrected logic, or truncate and regenerate:
     - `delete from public.review_aggregate_snapshots;`
     - rerun backfill script.
4. Recovery validation:
   - Re-run smoke checklist and review pipeline health endpoint.
