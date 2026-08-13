# Task 7 Report: Durable Digital Delivery

## Status

Complete on `codex/digital-products`. Paid digital orders now create durable manifest-bound delivery jobs, workers claim those jobs with expiring leases, and retries converge on one exact entitlement set, one reproducible active purchase token, and one provider-idempotent buyer notification.

## Implementation

### Transactional enqueue and checkout recovery

- Added a forward-only migration whose manifest-lock trigger enqueues the unique purchase-delivery job inside the same database transaction used by native paid-order finalization.
- A job cannot be created unless the exact manifest is locked to the same paid order and store.
- Stub checkout fault injection proves that a delivery-enqueue failure rolls back the paid order, manifest lock, and checkout completion together; retry then creates exactly one order and one job.
- Completed checkout, existing-order, stub-resume, and Stripe-resume paths explicitly ensure the job before returning success, repairing missing work without issuing entitlements synchronously.

### Manifest-only materialization

- Replaced catalog-based entitlement issuance with one service-role-only PostgreSQL materialization RPC.
- Entitlements are inserted exclusively from the locked purchase manifest. A missing, empty, cross-order, mutated, extra, or otherwise mismatched entitlement projection is an operational failure; there is no current-catalog fallback.
- Entitlement rows and the purchase token are materialized in one transaction. A forced failure on the second entitlement insert leaves no entitlement or token residue.
- Concurrent materialization retries converge on the exact locked asset versions even when newer catalog versions exist.

### Leased retries and dead-letter state

- Added an atomic `FOR UPDATE SKIP LOCKED` claim operation with opaque lease tokens, configurable lease duration, and one processing-attempt row per claim.
- Expired leases are recovered safely; expired final attempts become terminal merchant-visible failures.
- Failed attempts use bounded exponential backoff and a configurable maximum-attempt count. Terminal jobs retain a sanitized error while clearing lease ownership.
- Completion requires a recorded notification, at least one durable entitlement, and an active purchase token owned by the delivery job.
- All delivery mutation functions are executable only by `service_role`; existing store-member RLS continues to expose job and attempt status to the owning merchant.

### Stable secure token and notification handoff

- Purchase bearer tokens are derived with HMAC from a dedicated stable server secret, the job ID, and a non-secret per-token nonce. Only the nonce and SHA-256 digest are persisted.
- Retries reuse the active token row and re-derive the same bearer value; digest verification fails closed if the secret or row is inconsistent.
- Purchase access expires exactly 48 hours after token creation and retains the configured five-grants-per-file policy.
- Delivery email uses one stable Resend idempotency key per job. If the provider accepts a message but local notification persistence fails, retrying does not produce a second successful provider delivery.
- A recorded notification is never sent again, and bearer links, credentials, email addresses, and oversized detail are removed from persisted errors.

### Internal processor and operations configuration

- Added `POST /api/internal/digital-delivery/process`, protected by a separate minimum-32-character bearer secret and timing-safe digest comparison.
- The route fails closed before claiming work if either processor authentication or token derivation is not configured, returns only aggregate batch counts, and emits generic failures.
- Added validated immutable defaults for a 120-second lease, eight attempts, 60-second-to-six-hour exponential backoff, and batches of ten.
- Documented both required secrets, stable-secret rotation constraints, the email dependency, and scheduler authorization in the environment matrix, deployment runbook, example environment, and changelog.

## Files

- `supabase/migrations/20260813008000_durable_digital_delivery.sql` (new, forward-only)
- `apps/web/lib/digital-products/delivery-jobs.ts` (new)
- `apps/web/lib/digital-products/delivery-worker.ts` (new)
- `apps/web/lib/digital-products/entitlements.ts`
- `apps/web/lib/digital-products/config.ts`
- `apps/web/app/api/internal/digital-delivery/process/route.ts` (new)
- `apps/web/app/api/orders/checkout/route.ts`
- `apps/web/lib/storefront/checkout-finalization.ts`
- `apps/web/lib/notifications/email-provider.ts`
- `apps/web/lib/env.ts`
- `.env.example`, `docs/env-matrix.md`, `docs/runbooks/deployment-vercel.md`, and `CHANGELOG.md`
- Delivery, checkout, environment, email-provider, domain, and native PostgreSQL regression suites.

## TDD Evidence

### RED

The initial application regressions failed because delivery still queried the mutable catalog, checkout called synchronous issuance, no leased worker or authenticated processing route existed, email had no provider idempotency key, and token retries could not reproduce one bearer value.

The initial PostgreSQL contract failed because the durable migration and RPCs did not exist. Subsequent red runs exposed PostgreSQL offset timestamps rejected by the application schema, checkout recovery paths that returned before ensuring work, and a processor configuration path that could consume attempts before detecting the missing token secret.

### GREEN

Focused final durability evidence:

```text
Test Files 4 passed (4)
Tests 88 passed (88)
```

The native PostgreSQL contract has 75 passing assertions across fresh, upgrade, and complete migration chains. Task 7 coverage includes paid-order rollback on enqueue failure, atomic concurrent claim, second-row rollback, concurrent token/materialization convergence, exact locked-version selection, mismatch rejection, stale-lease recovery, exponential retry timing, safe error persistence, terminal dead-letter behavior, exact 48-hour expiry, and function privileges.

## Validation

- `npm run lint --workspace @myrivo/web` — passed with zero warnings/errors; both repository consistency checks passed.
- `npm run typecheck --workspace @myrivo/web` — passed.
- `npm test --workspace @myrivo/web` — 239 files and 844 tests passed.
- `npm run build --workspace @myrivo/web` — passed; production compilation, TypeScript, 159-page generation, optimization, and trace collection completed.
- `git diff --check` — passed.

The full suite retained only the pre-existing refund/dispute mock stderr and zero-size chart warnings. The build retained the existing Next.js middleware deprecation and stale Browserslist-data warnings.

## Self-Review

- **Immutable authority:** the worker has no catalog query path; SQL compares the complete order entitlement projection with the locked manifest.
- **Atomicity:** order/job creation is transactional at the native finalization boundary, while entitlement/token creation is a single RPC transaction. Checkout retries explicitly repair absent jobs.
- **Concurrency:** job claiming is atomic and skip-locked; stale ownership cannot materialize, notify, or complete after lease expiry.
- **Idempotency:** unique order/job and manifest/job constraints prevent duplicate work; entitlement conflict handling is followed by an exact row-count and identity check; active purchase-token reuse is database-enforced.
- **Notification safety:** a stable provider key covers the provider-accepted/local-write-failed window, and durable notification state covers completion retries.
- **Secret handling:** raw purchase tokens exist only in worker memory and email payloads. Database rows store a derivation nonce and digest; routes and persisted errors do not expose credentials or download URLs.
- **Tenant and privilege safety:** every relationship is checked across store, order, manifest, and job, and worker mutations are service-role-only.
- **Operations:** attempt state, next-attempt time, last safe error, and terminal failure are durable and visible to the owning merchant.

## Handoff

- The scheduler itself remains part of the later deployment/operations task; this task provides the authenticated endpoint and runbook contract it must call.
- The next notification/UX task can consume the durable job and attempt states to add richer merchant repair controls without changing delivery correctness.
- `DIGITAL_DELIVERY_TOKEN_SECRET` must be generated independently from the processor secret and remain stable across deploys; changing it invalidates reproduction of outstanding purchase links until the prior value is restored or those tokens are explicitly revoked and replaced.
