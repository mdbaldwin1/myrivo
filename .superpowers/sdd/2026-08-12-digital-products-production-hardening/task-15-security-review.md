# Task 15 Independent Security Re-review — Round 3

## Verdict

**FAIL — one P1 release blocker remains.** The prior bearer/API, CSRF, approval-binding, and pre-merge-gate findings are materially resolved in application code. However, the two security migrations use duplicate Supabase migration versions, so the actual deployment mechanism cannot reliably install the session authorization and release interlock. No P0 issue was identified.

## Finding

### P1 — Security migrations reuse existing Supabase versions and therefore are not deployable as written

Evidence:

- `supabase/migrations/20260813019000_secure_digital_download_sessions.sql` has version prefix `20260813019000`, but `supabase/migrations/20260813019000_digital_product_rollout_fix1.sql` already uses that version.
- `supabase/migrations/20260813020000_digital_release_acceptance_gate.sql` has version prefix `20260813020000`, but `supabase/migrations/20260813020000_digital_product_rollout_fix2.sql` already uses that version.
- Supabase migration history identifies migrations by the timestamp/version prefix. Two files with the same version cannot both be represented reliably in `supabase_migrations.schema_migrations`; normal CLI push/reset/repair behavior will reject, conflate, or skip one of each pair.
- The repository's native PostgreSQL test harness masks this because `apps/web/tests/digital-products-migration.test.ts:587-646` enumerates and executes every filename directly rather than reproducing Supabase migration-history semantics.
- These duplicated files contain the service-role-only `authorize_digital_download_session` RPC and the database-authoritative `digital_products_release_approvals`/runtime trigger. Missing either migration leaves the application broken or removes the rollout defense in depth.

Impact:

A real preview/production deployment cannot be trusted to install both security changes. Depending on which duplicate is recorded/applied, established download sessions may fail or the database rollout approval interlock may be absent. This fails the data-safety and operations release gates and must block release.

Required remediation:

Rename the two new, undeployed migration files to unique monotonically increasing versions after every existing migration (for example `20260813021000_...` and `20260813022000_...`; choose versions after checking shared migration history). Add a migration-contract test that rejects duplicate filename version prefixes. Run the official Supabase migration/reset/list workflow against a fresh non-production project and an upgraded project, and record that both versions appear exactly once before re-review.

## P2 observations

### P2 — Approval enforcement is tested indirectly, not with explicit mismatch/expiry cases

The SQL now joins runtime to approval on exact `release_version`, `evidence_sha256`, and `target_environment` (`20260813020000_digital_release_acceptance_gate.sql:40-56`), bounds approval age/expiry at lines 15-21, and requires current non-revoked approval. Those rules are sound on inspection. However, no focused migration tests explicitly prove that wrong release, wrong digest/environment, stale/revoked approval, future review timestamps, and missing reviewer timestamps are rejected while an exact approval succeeds. Add those tests after assigning unique migration versions.

### P2 — The pre-merge gate depends on pre-created evidence for GitHub's ephemeral SHA

`.github/workflows/ci.yml:53-69` now runs the strict gate on pull requests targeting `main` and safely materializes base64 secrets into temporary files. `scripts/verify-digital-products-acceptance.mjs:31-39` requires evidence whose `releaseVersion` exactly equals `GITHUB_SHA` and is less than one hour old before running Playwright. This fails closed, but maintaining a pre-created secret for an ephemeral PR merge SHA is operationally fragile. Prefer generating/signing evidence from the live acceptance run, then persisting its digest/approval, rather than requiring mutable global evidence secrets to predict the workflow SHA.

## Verified resolutions

- **No bearer in public API/path/log surfaces:** checkout status and authenticated-customer access now set the signed HttpOnly session and return only `/downloads` (`apps/web/app/api/orders/checkout-status/route.ts:52-68`; `apps/web/lib/digital-products/authenticated-customer-access-handler.ts:90-104`). Email/recovery bootstrap URLs use fragments, and no production download route accepts a token path.
- **Safe fragment retry:** `apps/web/components/customer/digital-download-list.tsx:98-118` removes the fragment immediately, retains the credential only in a React ref across transient failures, and clears it after successful exchange. It is not reinserted into history, DOM, storage, or API URLs.
- **POST plus origin protection:** grant issuance is now `POST`; `apps/web/app/api/digital-downloads/file/[entitlementId]/route.ts:13-26` enforces trusted origin before session/database work. Behavioral tests verify hostile origin rejection.
- **Exact rollout binding:** the approval/runtime join compares exact release, evidence digest, and target environment; approval timestamps are recent and expiry is at most seven days. Service-facing roles have no table access, and the trigger remains database-authoritative once deployed.
- **Pre-merge strict CI:** the promotion step runs on main-target pull requests and main pushes, fails for absent provider/fixture/evidence values, restricts the target to loopback or an explicit HTTPS non-production host, validates same-origin routes, and forces Playwright release mode.
- **Behavioral security coverage:** focused route tests execute hostile-origin, malformed credential, no-bearer serialization, session authorization, rate-limit failure, storage binding, grant release/commit, and safe-response behavior. Five focused suites passed: 68 tests.
- **External acceptance remains honestly blocked:** no real Stripe/Resend run is claimed. The missing fixture remains a rollout blocker and the strict script fails closed.

## Review scope

Reviewed fix report and diff `bdb8612..a26c7b1`, checkout/auth/email fragment and session flows, POST download route and UI, release fixture/actions, strict verifier, CI promotion condition, approval/runtime SQL, migration harness, and focused behavioral tests. No implementation file was changed.
