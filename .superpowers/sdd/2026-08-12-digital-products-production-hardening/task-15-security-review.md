# Task 15 Independent Security Re-review — Round 2

## Verdict

**FAIL — two P1 release blockers remain.** No P0 issue was identified. Commit `0466edb` materially improves the design: emailed credentials now use URL fragments, legacy bearer-path routes are removed, the bearer is exchanged under an origin check, and established requests re-authorize a signed HttpOnly session. However, the complete no-bearer-in-public-API invariant and the pre-promotion acceptance interlock are not yet enforced.

## Findings

### P1 — Raw access bearers still leave the server in public API JSON responses

Evidence:

- The new email/recovery URLs correctly use fragments: `apps/web/lib/digital-products/entitlements.ts:109`, `apps/web/lib/digital-products/customer-access.ts:451`, and `apps/web/lib/digital-products/delivery-email.ts:262` produce `/downloads#token=...`. Fragments are not sent in HTTP request targets, and `apps/web/components/customer/digital-download-list.tsx:103-110` removes the fragment before a same-origin body exchange.
- However, `apps/web/app/api/orders/checkout-status/route.ts:50-62` derives the raw access bearer and returns it as `digitalAccessUrl` in a JSON response.
- `apps/web/lib/digital-products/authenticated-customer-access-handler.ts:94-106` validates and returns the same fragment-bearing URL from the authenticated customer access API.
- `apps/web/components/customer/digital-order-downloads.tsx:36-43` expects that bearer-bearing API field.
- These responses contradict the plan's Definition of Done: “No ... bearer token ... appears in public APIs, analytics, audit metadata, templates, or logs.” The runbook's statement that bearers are never logged cannot be guaranteed when response-body logging, tracing, or error capture can observe these API payloads.
- There is also a functional mismatch at `apps/web/components/storefront/storefront-checkout-page.tsx:201-206`: the API now returns `/downloads#token=...`, but the checkout client accepts only `/downloads/<token>`. That prevents the intended first-access link and shows this path was not exercised end-to-end after the redesign.

Impact:

The 48-hour order-wide credential remains available to API response logging/observability and client-side interception in two common buyer flows. A compromised log sink or captured response grants access to all entitled files and can consume download grants. The path/history leak was removed, but the approved stronger invariant remains false.

Required remediation:

Never return the raw bearer from checkout-status or authenticated-order APIs. Establish the signed HttpOnly download session server-side in those responses after binding the checkout session or authenticated customer to the eligible order, and return only `/downloads` plus non-sensitive state. Restrict the session cookie path to the narrowest usable API scope and preserve expiry/revocation re-authorization. Email/recovery may carry the credential in a fragment because delivery requires an out-of-band bootstrap, but no JSON API should serialize it. Add behavioral tests that assert checkout and authenticated access set a secure session cookie, serialize no token-shaped value, and complete the actual storefront/customer flows.

### P1 — The strict provider gate runs after main is updated, so it does not prevent promotion

Evidence:

- `scripts/verify-digital-products-acceptance.mjs:10-35` correctly fails closed for missing fixture/evidence/provider credentials and forces the digital Playwright suites into release-gate mode.
- But `.github/workflows/ci.yml:53-63` runs it only when `github.ref == 'refs/heads/main'`.
- For a pull request into `main`, `github.ref` is a pull-request ref, so the promotion PR can pass and merge without this step. The gate runs only on the subsequent push to `main`, when an automatic main deployment may already be underway or complete.
- The database trigger at `supabase/migrations/20260813020000_digital_release_acceptance_gate.sql:23-44` is useful defense in depth, but it accepts any unexpired global approval. Although the table records `release_version`, `environment`, and `evidence_sha256` at lines 1-14, the trigger does not compare any of them with the deployed release or store/environment. Thus an approval for an older or unrelated build remains sufficient to enable stores after a later unaccepted deployment.

Impact:

The external Stripe/Resend acceptance blocker remains documented and local gate invocation fails correctly, but it can still be bypassed operationally: code can be promoted/deployed before provider acceptance, and an old approval can authorize rollout for a different release. This does not meet the requirement that acceptance and three reviews be a hard rollout prerequisite.

Required remediation:

Run the strict acceptance gate as a required check on `pull_request` events targeting `main` (or in an explicit deployment/promotion workflow that must succeed before production deployment). Materialize fixture/evidence secret contents into ephemeral files rather than treating GitHub secret strings as runner-local paths. Bind database approval to an immutable deployed release identifier/evidence digest and require the current expected release in the rollout RPC/trigger transaction; reject mismatched environment, future review timestamps, expired/revoked approval, or an approval created for another build. Add native PostgreSQL tests proving old/mismatched approvals cannot enable rollout.

### P2 — Grant issuance remains a state-changing cross-site-navigable GET

Evidence:

- `apps/web/app/api/digital-downloads/file/[entitlementId]/route.ts:12-23` reserves and commits one of five lifetime grants during `GET` and returns a redirect.
- The session cookie is `SameSite=Lax` at `apps/web/lib/digital-products/download-service.ts:227-238`, so browsers send it on top-level cross-site GET navigation.
- No trusted-origin or one-time form nonce is checked on the grant endpoint.

Impact:

An attacker who learns or can induce a victim to navigate to an entitlement UUID can consume a scarce grant and trigger a download. UUID entropy limits blind exploitation, but state mutation on a Lax-cookie GET is avoidable and weakens defense in depth.

Recommended remediation:

Issue grants through a same-origin POST protected by trusted-origin/CSRF validation, then return a short-lived redirect target or initiate the download from the successful response. Keep the final storage GET independently signed. Add a hostile-origin/top-level-navigation regression test.

### P2 — Prior behavioral-test gap is only partially resolved

Evidence:

- `apps/web/tests/digital-download-session-route.test.ts:17-45` now behaviorally tests hostile origin, malformed credentials, hashed lookup, no echo, HttpOnly cookie, neutral unavailable response, and no-store. `apps/web/tests/digital-download-route.test.ts` behaviorally exercises rate limiting, session authorization, grant lifecycle, storage binding, and safe errors. These are meaningful improvements.
- The former source-substring suite was deleted, but no replacement Task 15 cross-route attack suite was added for the full merchant asset/preview/recovery/platform/financial surface. Existing focused tests mitigate this, but the Task 15 claim that all relevant endpoints were behaviorally attacked remains broader than the evidence.
- There is no test catching the checkout fragment-regex mismatch described in the first P1.

Recommended remediation:

Add a table-driven behavioral release suite covering every digital mutation with hostile origin, unauthenticated identity, cross-tenant IDs, malformed UUID/body size, throttler failure/denial, and safe response/log serialization. Include checkout-status and authenticated-access tests that prohibit bearer serialization and an end-to-end assertion for the bootstrap session.

## Verified improvements

- No production download page or API route contains the bearer in a request path. The legacy `[token]` page and API routes were removed.
- The fragment is removed with `history.replaceState` before exchange, and exchange uses POST body plus `enforceTrustedOrigin` (`apps/web/app/api/digital-downloads/session/route.ts:13-30`).
- The established cookie is signed over random session ID plus opaque access-token row ID, HttpOnly, SameSite=Lax, Secure in production, and every list/grant request calls service-role-only `authorize_digital_download_session` to re-check expiry, revocation, and payment eligibility (`20260813019000_secure_digital_download_sessions.sql:1-28`).
- The strict verification script rejects missing acceptance prerequisites and free-form evidence is no longer sufficient. The E2E suites throw rather than skip when invoked in release-gate mode.
- Focused session/download/platform operation tests passed: 3 files, 33 tests.
- The external Stripe/Resend fixture remains explicitly unfulfilled and must continue to block rollout; this review does not classify the missing external credentials themselves as a defect.

## Review scope

Reviewed fix report and diff `b96918e..0466edb`, credential generation/exchange/session/list/grant flows, checkout and authenticated-order access, new migrations, rollout operations, CI and verification script, E2E gates, focused unit tests, and the operations runbook. No implementation file was changed.
