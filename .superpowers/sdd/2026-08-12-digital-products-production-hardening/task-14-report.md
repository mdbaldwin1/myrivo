# Task 14 Report: Rollout Controls, Studio, Telemetry, and Operations

## Status

Implementation complete on `codex/digital-products` and ready for independent review.

## Implementation

- Added strict `digitalProducts` plan eligibility plus a dedicated store flag. Effective access requires both boolean values to be true and otherwise fails closed.
- Added database-authoritative gates for new digital catalog, asset, preview, manifest, and pending checkout state. Application routes also gate merchant actions, storefront visibility, cart preview, and new/pending checkout.
- Preserved delivery, access, recovery, resend, download, refunds, disputes, and reconciliation for completed paid orders after disablement. Physical products remain unaffected.
- Added Storefront Studio digital-only and mixed fixtures for product, cart, and order-summary views.
- Added a merchant-editable Digital Delivery email template with safe file-count and access-window fields. Templates and scenarios expose no bearer, token, signed-URL, or storage-path variables.
- Added allowlisted privacy-safe telemetry storage and transition capture, a bounded delivery-health RPC, and audited idempotent rollout/requeue/reconcile functions.
- Added an admin-only operations API and Digital Product Operations view with requeue, resend, and reconcile controls.
- Added the rollout and incident runbook at `docs/runbooks/digital-products-rollout-operations.md`.

## TDD Evidence

### RED

- Feature policy tests failed on the missing feature resolver.
- PostgreSQL tests failed on the missing store flag, database gates, and service-only RPCs.
- Studio tests failed on the missing digital template and digital-only/mixed fixtures.
- Operations tests failed on the missing admin route, and telemetry tests failed on the missing safe recorder.

### GREEN

- Feature and route policy: 5 tests passed.
- Studio and Email Studio: 15 tests passed.
- Operations and telemetry: 6 tests passed.
- Real PostgreSQL migration/integration suite: 116 tests passed.

## Security and privacy boundaries

- Platform admin authorization, trusted-origin validation, typed payloads, and idempotency keys protect operator mutations.
- Rollout and health functions are executable only by `service_role`.
- Operational telemetry accepts only fixed event types and allowlisted bounded dimensions. Health output returns only issue/status codes, UUIDs, counts, and age.
- Existing access-token, signed-URL, private-path, and customer-data protections remain unchanged.

## Validation

- `npm run lint --workspace @myrivo/web` — passed with zero warnings/errors; consistency checks passed.
- `npm run typecheck --workspace @myrivo/web` — passed.
- `npm test` — 265 files and 1,064 tests passed.
- `npm run build` — passed; optimized Next.js build and TypeScript validation completed.
- `git diff --check` — passed.

## Handoff

- Roll out by enabling an eligible plan first, then individual stores in small cohorts.
- Disable the store flag for rollback; do not delete paid-order delivery or access state.
- `bd` was unavailable in the worktree (`command not found`), so task evidence is recorded here and in the SDD progress ledger.
