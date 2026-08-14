# Task 15 Independent Security Re-review — Round 8

## Verdict

**FAIL — one P1 credential-leak blocker remains.** Provider-specific refund/dispute/webhook/Resend evidence is now carried into the signed artifact and correlated by the verifier; database-owned acceptance configuration and helper security remain sound. However, five-grant evidence serializes complete active HttpOnly download session cookies, turning the evidence artifact into a collection of reusable bearer credentials.

## Finding

### P1 — Signed acceptance evidence contains raw download-session bearer cookies

Evidence:

- `apps/web/e2e/digital-products.spec.ts:54-80` creates six independent browser contexts, calls `context.cookies()`, and appends `${cookie.name}:${cookie.value}` for every cookie into `sessionIds`.
- At line 82, those raw strings are passed as `providerEvidence.sessionIds` for the `five-grants` scenario.
- `apps/web/lib/digital-products/acceptance-evidence.ts:42` accepts six arbitrary non-empty session strings rather than privacy-safe digests.
- `apps/web/e2e/digital-products-fixture.ts:38-44` writes this provider evidence into the HMAC-signed evidence file. The verifier reads and hashes that file, and the acceptance workflow/runbook expects its digest to be retained for release approval.
- The `myrivo_download_session` cookie contains the signed opaque access-token row/session identity and is HttpOnly precisely because possession authorizes listing and grant requests. Capturing its full value defeats the browser boundary and conflicts with the approved invariant that bearer credentials never appear in evidence, logs, or persisted artifacts.

Impact:

Anyone with access to the acceptance artifact can replay one of the captured cookies against the preview host until token/session expiry, list purchased files, and consume/download remaining grants. The artifact also becomes sensitive secret material that is likely to be retained or shared as release evidence.

Required remediation:

Never serialize cookie names or values. Derive a one-way, domain-separated digest inside the browser test (prefer HMAC with a separate CI-only evidence key, otherwise SHA-256 over a random run salt plus the cookie value), store only six unique digests, and clear the raw cookie arrays immediately. Rename the schema field to `sessionFingerprintHashes`, require exactly six unique 64-hex values, and reject cookie-shaped strings (`myrivo_download_session`, `v2.`, separators). Add a test scanning the complete serialized evidence for access tokens, session cookie names/values, signed URLs, private paths, authorization headers, provider/API secrets, and email credentials before signing and again in the verifier.

## P2 observations

### P2 — Webhook signature verification is asserted rather than persisted

Financial provider evidence sets `signatureVerified: true` in the browser code after finding a processed ledger row. The ledger exists only after the webhook route's `constructEvent` succeeds, so this is a reasonable inference, but the evidence schema/verifier does not independently prove that property. Prefer an explicit immutable ingestion field/version or treat processed ledger existence as the canonical proof without a caller-supplied boolean.

### P2 — Resend message freshness and delivery status remain weakly represented

The retrieval code labels a successfully retrieved message as `status: "sent"` and uses `created_at` opportunistically, but does not query provider delivery events/status or reject a message older than the current run. Bind the message ID to current-run start/order/recipient/sender and require provider delivery status/timestamps in the signed evidence.

## Verified resolutions

- The observer now loads correlated refunds, disputes, source-event ledger rows, delivery attempts, and catalog asset versions under the run/store-bound service-role control.
- Canonical scenario evidence is discriminated for checkout, refund, dispute, Resend, grants, replacement, and delivery retry; the writer validates the exact scenario/evidence pair before signing.
- The verifier requires provider evidence for every scenario and checks PaymentIntent/order, refund/dispute webhook processing, Resend order/recipient, exact composition, five unique grants, and manifest versions.
- Refunds use Stripe test API and are correlated to persisted refund/source-event/webhook rows. Disputes use an exact allowlisted HTTPS helper origin, no redirects, bounded timeout, bearer authentication, and HMAC-authenticated request/response bound to the PaymentIntent/outcome/provider IDs.
- Replacement evidence binds prior immutable version and content hash to a distinct current version and a fresh checkout manifest. Delivery retry evidence captures failed/succeeded attempts and resend identity.
- Database configuration remains inaccessible to service/application roles; RPC observe/mutations enforce active configuration and run/store target. Preview/production routing remains fail closed.
- Prior bearer URL/API, POST/origin, migration uniqueness, release approval/runtime, and provider fail-closed findings remain resolved.
- Focused control/evidence/migration-version tests passed: 3 files, 10 tests. External Docker and provider execution remain rollout blockers rather than code defects.

## Review scope

Reviewed diff `84c88ec..5f73e6a`, strict evidence schemas and tests, observer queries, provider helper authentication, financial webhook correlation, Resend retrieval, grant/session evidence, replacement/version hashing, delivery retry evidence, verifier and CI configuration, and prior security findings. No implementation file was changed.
