# Task 15 Independent Security Re-review — Round 9

## Verdict

**PASS — no P0 or P1 security findings.** The prior raw-session evidence leak is resolved, the storage-signing fault is narrowly bound and one-shot, webhook signature verification is persisted, and canonical evidence now correlates provider objects, webhook processing, application state, grants, immutable replacement versions, and delivery retry history. Real Stripe/Resend execution and official Supabase/Docker verification remain explicit external rollout gates; this review does not claim they ran.

## Verified controls

### Evidence credential hygiene

- `apps/web/e2e/digital-products.spec.ts` no longer serializes cookie names or values. Each independent session is converted immediately to a domain-separated HMAC via `acceptanceSessionHash()`.
- `apps/web/lib/digital-products/acceptance-evidence.ts:4-7` requires a 32+ character redaction key and produces only a 64-hex HMAC.
- The strict grants schema requires exactly six unique session hashes and exactly five unique grant IDs. CI requires the redaction key to be different from both the evidence-signing key and control bearer.
- Evidence is recursively scanned before signing and again by the verifier for token fragments, cookie material, signed URL query signatures, private paths, and download-session identifiers.
- No replayable access bearer, HttpOnly cookie, storage signature, or private object path was found in the signed evidence model.

### Signing-failure safety

- The acceptance RPC creates a one-shot fault only after validating database-owned active non-production configuration, active unexpired run target, store, and subject order.
- `consume_digital_acceptance_signing_fault` additionally binds run, entitlement, order, and store, atomically decrements `remaining`, and is executable only by service role.
- Application injection is enabled only for an acceptance build/deployment with an explicit run ID; ordinary production cannot activate it.
- The browser exercises the failure through the real grant/download path and checks the grant count before and after. Subsequent five-session, grace-reuse, corrupt-token, and sixth-denial checks are independently recorded.

### Provider and webhook evidence

- Stripe webhook ingestion writes `signature_verified=true` only after `constructEvent` has succeeded; the value is persisted in the webhook ledger and returned by the run/store-bound observer.
- Refund evidence correlates Stripe refund ID, PaymentIntent, amount/status, source event, persisted processed webhook, signature flag, attempts, and application refund state.
- Dispute evidence correlates HMAC-authenticated helper output, dispute/charge/PaymentIntent IDs, expected outcome/event sequence, processed signed webhook ledger row, and final application access state.
- The dispute helper is restricted to an exact allowlisted HTTPS origin, rejects redirects, has bounded timeout, uses separate bearer authentication, and authenticates both request and response bodies with HMAC.
- Checkout evidence binds `cs_test_` session, PaymentIntent, returned order, composition, and manifest versions. Resend evidence binds message ID, recipient, order, fragment-link hash, and timestamp.

### Grant, replacement, and delivery integrity

- Five grants use distinct browser sessions; same-session grace reuse, a post-reservation signing failure consuming no grant, and sixth-session denial are all required by the typed evidence.
- Replacement acceptance hashes actual prior buyer bytes before and after replacement, requires equality for the prior buyer, requires different bytes/version for a fresh checkout, and binds the fresh manifest to the replacement version.
- Delivery retry evidence includes the bound job, failed/succeeded attempt sequence, timestamps, and resend provider message identity.
- The verifier rejects missing or duplicate scenarios, wrong fixed subjects, wrong checkout composition, missing manifests, uncorrelated provider evidence, invalid signed webhooks, and stale or incorrectly signed run evidence.

### Database and rollout boundaries

- Acceptance configuration is database-owned and inaccessible to service/application roles. Observe and mutation requests cross the service-role-only RPC and enforce active configuration plus run/store target.
- Migrations have unique monotonic versions and focused tests cover application-role denial, run/store tampering, invalid transitions, and mutation idempotency.
- Production rollout remains bound to an exact release version, evidence digest, target environment, current approval, and independent review timestamps.
- Main-target promotion runs the strict acceptance command before merge and fails closed for absent provider/helper/fixture/evidence prerequisites.

## Non-blocking P2 follow-ups

- Expand the recursive secret scanner with explicit token-shape and provider-secret patterns (`sk_test_`, `re_` API keys where distinguishable, authorization headers) while avoiding false positives for safe provider object IDs.
- Replace the caller-facing `signatureVerified` duplication in provider evidence with a verifier rule derived directly from the correlated immutable ledger row, reducing redundant asserted state.
- Strengthen Resend acceptance from retrievable/sent evidence to provider delivery-event evidence with sender-domain and current-run freshness checks.
- Rename the local `sessionIds` variable in the browser suite to `sessionHashes` to prevent future confusion; its contents are hashes today.

## Validation evidence

- Focused control/evidence/migration-version suites passed: 3 files, 11 tests.
- Fix report records full lint, typecheck, 1,104+ tests, and production build success from the preceding round; this review inspected the round-9 diff and security-critical paths without editing implementation.
- External real-provider execution and official Supabase fresh/upgrade workflow remain rollout blockers until their environment dependencies are available.

## Review scope

Reviewed diff `23141e9..6e8dc70`, evidence HMAC/scanner/key separation, five-grant and signing-failure browser flow, database acceptance fault tables/RPCs/privileges, download service injection guard, webhook signature ledger migration/write path, provider/helper correlations, replacement byte/version evidence, delivery retry evidence, verifier, CI secrets, and all prior security findings.
