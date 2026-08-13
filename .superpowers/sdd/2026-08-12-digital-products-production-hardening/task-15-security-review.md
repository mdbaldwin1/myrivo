# Task 15 Independent Security Review

## Verdict

**FAIL — two P1 release blockers.** No P0 finding was identified. The feature must remain disabled outside an internal security fixture until both P1 findings are resolved and re-reviewed. The missing external Stripe/Resend fixture is not itself counted as a code defect; the defect is that the repository does not technically enforce that gate and a skipped acceptance run exits successfully.

## Findings

### P1 — Download bearer tokens are embedded in request paths and therefore cannot satisfy the no-logging invariant

Evidence:

- `apps/web/lib/digital-products/entitlements.ts:107` constructs the emailed access URL as `/downloads/${accessToken}`.
- `apps/web/app/downloads/[token]/page.tsx:5-11` accepts that bearer in the page pathname and passes it into a client component.
- `apps/web/components/customer/digital-download-list.tsx:103` sends the same bearer in the API list pathname.
- `apps/web/components/customer/digital-download-list.tsx:252` sends it again in each grant/download pathname.
- `apps/web/app/api/digital-downloads/[token]/route.ts:27-29` and `apps/web/app/api/digital-downloads/[token]/[entitlementId]/route.ts:30-34` read the credential from route parameters.
- The approved invariant says no bearer token may appear in logs, while `docs/runbooks/digital-products.md:14` claims access bearers are never logged. Response headers such as `Referrer-Policy: no-referrer` at `apps/web/lib/digital-products/download-service.ts:224-234` cannot prevent the application host, CDN, proxy, WAF, observability tooling, or browser history from observing the incoming request path.

Impact:

An access token is a 48-hour bearer credential for every entitled file on the order. Ordinary URL/access logging, error traces, browser history synchronization, copied screenshots, or analytics that capture page locations can retain it. Anyone who obtains it can consume grants and retrieve purchased originals. This directly violates a Definition-of-Done security invariant and the runbook's operational claim.

Required remediation:

Do not put the bearer in a server-visible URL path or query. A robust pattern is an email URL whose credential is in the fragment (`/downloads#token=...`), followed by client code that exchanges it once in a same-origin POST body for a short-lived, HttpOnly, Secure, SameSite cookie/session bound to the order, then immediately removes the fragment with `history.replaceState`. List and grant endpoints should use the server-side session rather than repeat the bearer in URLs. Ensure request/error/analytics telemetry rejects token-shaped values, add tests against path/query/DOM/history leakage, and update the runbook only after the invariant is actually true. If infrastructure-level redaction is chosen instead, it must be deployed and acceptance-tested across every request-log and observability sink, but a credential-free URL design is safer.

### P1 — Real-provider acceptance is procedural only; skipped tests pass and rollout has no acceptance interlock

Evidence:

- `apps/web/e2e/digital-products.spec.ts:17-24` returns `null` for a missing fixture and globally calls `test.skip`, so the required provider journeys exit successfully with zero executed tests.
- `apps/web/e2e/digital-products-accessibility.spec.ts:20-28` does the same for the accessibility gate.
- The Task 15 report records the actual result as 12 skipped tests, while `docs/runbooks/digital-products.md:132` correctly says such a run is not acceptance. The command nevertheless has a successful process status.
- `.github/workflows/ci.yml:37-44` runs E2E only when generic Supabase/owner credentials exist; it does not require `MYRIVO_DIGITAL_ACCEPTANCE_FIXTURE`, `MYRIVO_DIGITAL_ACCEPTANCE_EVIDENCE`, Stripe test mode, or Resend acceptance configuration, and it does not fail on skipped digital-product tests.
- `apps/web/app/api/platform/digital-products/operations/route.ts:66-102` permits any platform admin to invoke rollout after origin/auth/schema checks, but has no checked acceptance/reviewer state.
- `supabase/migrations/20260813018000_digital_product_rollout_operations.sql:83-140` enables a store based on operator input and plan eligibility only. There is no recorded provider-acceptance/review prerequisite in the transaction.

Impact:

The external acceptance blocker is clearly documented but can be accidentally bypassed: CI can be green with all digital acceptance tests skipped, and an admin can then enable a non-internal store. This can expose paid buyers to an unverified Stripe/webhook/email/download path and defeats the plan's operations and release gates.

Required remediation:

Split fixture-independent smoke/list behavior from a release-gate command that fails (not skips) if the non-production fixture, redacted evidence, Stripe test mode, Resend recipient, or any required scenario is absent. Make CI/release automation run that strict command before promotion. Persist an auditable acceptance approval (environment, timestamp, evidence digest, reviewer approvals, expiry/version) and require it in the same server/DB transaction that enables a non-internal store; alternatively enforce an internal-store allowlist until a platform-wide release approval exists. The enable control should show the unmet prerequisites and be disabled, and the RPC must remain authoritative against API/UI bypass.

### P2 — The new release-security suite mostly asserts source substrings rather than behavior

Evidence:

- `apps/web/tests/digital-products-release-security.test.ts:25-32`, `34-45`, `47-55`, `57-71`, and `73-84` use `toContain`/regex checks against source files.
- These assertions can pass when a protection is in an unused branch, comment, or helper call whose return value is ignored. They do not send hostile requests, measure throttling, inspect actual response/log output, or exercise malformed/compressed files.
- The suite covers only four owner mutation routes at `apps/web/tests/digital-products-release-security.test.ts:18-23`, despite additional replace, update, delete, retry, reorder, preview, recovery, platform-operation, and financial mutation surfaces.

Impact:

The test suite overstates assurance and is weak against security regressions. Existing focused tests elsewhere mitigate part of this risk, but Task 15's claimed cross-cutting release contract is not genuinely enforced by these nine tests.

Recommended remediation:

Replace source inspection with route-level tests that execute every mutation under missing/foreign origin, unauthenticated identity, cross-tenant IDs, malformed UUIDs, oversized JSON, and throttler failure/denial. Add byte-stream fixtures for truncated and spoofed formats and decompression/pixel-abuse cases, concurrent real-Postgres grant tests, captured structured-log assertions, and an allowlist scan over serialized public responses. Keep migration privilege/index assertions where runtime database tests are impractical, but prefer the existing native PostgreSQL harness.

## Additional observations

- Tenant ownership on merchant asset routes is consistently checked through authenticated owner/store resolution, with database composite constraints and service-role-only RPCs providing meaningful defense in depth.
- Grant reserve/commit/release logic in `20260813011000_harden_atomic_digital_download_grants.sql` serializes entitlement/grant state, re-checks token and payment eligibility after lock acquisition, binds reuse to token plus fingerprint, and grants execution only to `service_role`; no release-blocking concurrency flaw was found in this review.
- Upload finalization streams bytes with a hard byte ceiling and signature/declared-size comparison, while Sharp preview work limits input pixels and source bytes. No release-blocking decompression issue was identified for the supported workflow, although stronger semantic validation/malware handling for downloadable PDF/ZIP content remains a defense-in-depth consideration.
- Refund/dispute transition RPCs are service-role-only and transactional, and platform repair operations require platform-admin authorization, trusted origin, strict UUID input, and idempotency keys.
- The lack of external Stripe/Resend credentials remains an explicit rollout blocker in the report and runbook. It must remain blocked; the second P1 explains why documentation alone is insufficient.

## Review scope

Reviewed Task 15 commit `e4d7e62`, the production-hardening plan and Task 15 brief/report, download/recovery/asset services and routes, rollout operations, relevant migrations and privilege grants, release-security/E2E tests, CI workflow, and the digital-products operations runbook. No implementation files were changed by this review.
