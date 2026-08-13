# Task 13 Report: Synchronize Digital Access with Financial State

## Status

Implementation complete on `codex/digital-products` and ready for the independent webhook/idempotency checkpoint review.

## Implementation

### Transactional financial access state

- Added service-role-only PostgreSQL RPCs that lock the order and atomically persist the provider financial state, entitlement transition, terminal token revocation, idempotency row, and audit event.
- Added immutable source event IDs and source-created timestamps to refunds and disputes. Duplicate events are no-ops, older events cannot regress newer state, and terminal refund/dispute outcomes cannot be overwritten by contradictory later states.
- Cumulative successful refunds preserve access until their sum reaches the order total. At that point all entitlements become `revoked:full_refund` and all active access tokens are revoked.
- Open dispute and warning states suspend access with the originating dispute ID. Closed warnings, wins, and prevented outcomes restore only rows suspended by that dispute. Full-refund and lost-dispute revocations remain terminal.
- Financial precedence is full refund, any lost dispute, any open dispute, then active. Multiple open disputes are evaluated together, so resolving one cannot restore access while another remains open.
- Forward migration backfills existing financial states, preserves source-null legacy/manual dispute suspensions for upgrade compatibility, and enforces financial state when entitlements or tokens materialize after the provider transition.

### Webhook and callable service behavior

- Replaced best-effort application table updates and swallowed access failures with validated RPC wrappers in `access-state.ts`.
- Stripe webhooks pass the immutable event ID and event-created timestamp to the transaction. RPC failures propagate, leave the webhook ledger failed/unprocessed, and return a retryable server error.
- Customer notification begins only after the authoritative transaction succeeds and only for a material financial state change.
- Stub refund completion uses the same transaction. If Stripe creates a real refund but access synchronization fails, the local refund remains processing for webhook convergence instead of being incorrectly labeled failed.

### Reconciliation and operations

- Added a bounded, service-role-only reconciliation RPC and a strict TypeScript result parser.
- Detects paid digital orders missing delivery work or entitlements, full refunds with active access, open/lost dispute mismatches, and terminal orders with active tokens.
- Output is deliberately restricted to issue code, order/store IDs, and aggregate counts; tests reject customer data, filenames, storage paths, bearer values, and token hashes.
- Updated the refund/dispute operations runbook with access policy, ordering, retry, reconciliation, and repair guidance.

## TDD Evidence

### RED

- Application tests initially failed because refund/dispute synchronization mutated tables independently, sent notifications despite access failures, and did not pass immutable source ordering.
- Direct refund tests failed because stub success bypassed the transaction and because post-Stripe RPC failure was rewritten as a provider failure.
- The migration test failed before the forward migration existed. Its first upgrade run then exposed the legacy source-null suspension compatibility case before the constraint was narrowed.

### GREEN

- Focused webhook, synchronization, and callable-service suite: 3 files, 11 tests passed.
- Direct refund execution suite: 3 tests passed.
- Real PostgreSQL migration/integration suite: 99 tests passed.
- Full suite: 259 files, 1,028 tests passed.

Real PostgreSQL coverage includes cumulative partial/full refunds, duplicate/stale events, all warning/open resolution paths, open-to-lost, full-refund-then-win, lost-then-win, multiple disputes, injected audit failure rollback, concurrent out-of-order events, safe reconciliation, and service-role privileges.

## Validation

- `npm run lint --workspace @myrivo/web` — passed with zero warnings/errors; consistency checks passed.
- `npm run typecheck --workspace @myrivo/web` — passed.
- `npm test` — 259 files and 1,028 tests passed.
- `npm run build` — passed; optimized Next.js build and TypeScript validation completed.
- `git diff --check` — passed.

The full suite retained the existing zero-size chart stderr. The build retained the existing Next.js middleware deprecation and stale Browserslist-data warnings.

## Principal Files

- `supabase/migrations/20260813017000_transactional_financial_digital_access.sql` (new)
- `apps/web/lib/digital-products/access-state.ts` (new)
- `apps/web/lib/orders/refund-dispute-sync.ts`
- `apps/web/app/api/stripe/webhooks/route.ts`
- `apps/web/app/api/orders/refunds/[refundId]/route.ts`
- `apps/web/types/database.ts`
- `apps/web/tests/digital-access-state.test.ts` (new)
- `apps/web/tests/refund-dispute-sync.test.ts`
- `apps/web/tests/stripe-webhooks-route.test.ts`
- `apps/web/tests/order-refund-execution-route.test.ts`
- `apps/web/tests/digital-products-migration.test.ts`
- `docs/runbooks/refunds-disputes-operations.md`
- `CHANGELOG.md`

## Handoff

- Run the Task 13 independent webhook/idempotency review against the complete task commit.
- Reconciliation is diagnostic and intentionally does not mutate state. Prefer replaying the original Stripe event through the normal webhook path, then rerun reconciliation.
- `bd` was unavailable in the worktree (`command not found`), so task evidence is recorded in this report and the SDD progress ledger.
