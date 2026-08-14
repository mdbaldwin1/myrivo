# Task 14 Fix 1 Report: Rollout and Operations Concurrency

## Status

Implementation complete on `codex/digital-products` as a separate follow-up to Task 14.

## Findings addressed

- Application plan resolution now selects `billing_plans.active` and requires the value to be exactly `true`, matching the database effective-feature function. Inactive-plan storefront cart and checkout regressions fail closed while physical items remain available.
- A database `BEFORE INSERT` settlement guard locks the pending checkout and rechecks the effective rollout before the atomic checkout wrapper can create the first paid order. Stub and Stripe payment references are rejected after disablement with no order, inventory, or manifest mutation. Completed paid-order retries and delivery repair remain available.
- Paid pending digital checkouts blocked by rollout persist a safe failed status directing the customer to refund support instead of exposing a raw database error.
- Delivery repair preserves `attempt_count` as the monotonic attempt-ledger identity and adds `repair_generation` plus `generation_attempt_count` for the resettable worker budget. An exhausted attempt 8 requeues explicitly and claims unique global attempt 9 as generation 1, budget attempt 1; audit metadata records the repair generation and prior attempt count.
- Rollout, requeue, and reconciliation RPCs acquire transaction-scoped advisory locks over store/action/request hash before their duplicate check. Concurrent identical requests produce one operator-action row and one audited mutation; the duplicate returns the stable no-op result.
- Application and database telemetry now enforce event-specific closed dimension schemas using fixed keys, enum strings, and bounded integer attempts. Direct database inserts cannot bypass the policy with free-form labels, cross-event keys, negative values, or oversized values.

## TDD evidence

### RED

- Inactive app plan resolved enabled when both feature flags were true.
- Six event-specific invalid application payloads were accepted.
- Direct database telemetry accepted event/key mismatches and free-form values.
- Terminal delivery repair had no separate budget or generation, so attempt 8 could not be claimed after requeue.
- Operator functions checked idempotency before acquiring any request-scoped serialization.
- Paid pending settlement had no explicit first-order-row rollout assertion.
- Raw database settlement failure copy reached the checkout status instead of safe refund-support guidance.

### GREEN

- Focused application feature, telemetry, checkout, cart, finalization, and operations tests pass.
- Real PostgreSQL migration/integration suite passes all 121 tests, including three two-session duplicate-operation races.

## Validation

- `npm run lint --workspace @myrivo/web` — passed with zero warnings/errors; consistency checks passed.
- `npm run typecheck --workspace @myrivo/web` — passed.
- `npm test` — 265 files and 1,080 tests passed.
- `npm run build` — passed; optimized Next.js build and TypeScript validation completed.
- `git diff --check` — passed.

## Operational notes

- A disabled pending digital payment must follow refund support; never bypass the settlement guard.
- Health output separates global attempt history from the current repair generation budget.
- Idempotency keys are scoped to store and action and serialized before mutation.
- `bd` remains unavailable in the worktree, so evidence is recorded in this report.
