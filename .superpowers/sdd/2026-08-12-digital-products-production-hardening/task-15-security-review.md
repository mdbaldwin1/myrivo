# Task 15 Independent Security Re-review — Round 4

## Verdict

**FAIL — two P1 release blockers remain in the acceptance-control boundary.** Migration versions, release-approval behavior/privileges, bearer handling, POST/origin protection, and evidence binding are now materially improved. Docker and real provider availability remain external rollout blockers rather than code defects, but the repository-side acceptance control is not yet production-safe or executable.

## Findings

### P1 — The acceptance mutation RPC is referenced but does not exist

Evidence:

- `apps/web/lib/digital-products/acceptance-control.ts:17-22` invokes service-role RPC `acceptance_control_digital_products` for reset, delivery-failure, refund, and dispute mutations.
- Repository-wide search finds no SQL definition, migration, generated database type, or test implementation of `public.acceptance_control_digital_products`—the only reference is the caller.
- `apps/web/tests/digital-acceptance-control-route.test.ts` mocks `executeDigitalAcceptanceControl`, so it cannot catch the missing RPC.
- The browser suite depends on these mutations to create deterministic acceptance state and provider transitions. Every non-observe action will fail at runtime, causing the strict gate to fail even with valid Stripe/Resend credentials.

Impact:

The required real-provider acceptance path cannot execute, so release approval can never be generated honestly from the checked-in system. This is fail-closed, but it is a release blocker rather than an external credential limitation.

Required remediation:

Add a uniquely versioned migration defining a narrowly scoped, service-role-only acceptance RPC, or replace it with explicit test-provider operations implemented in the server service. It must reject production and non-acceptance stores at the database boundary, bind every subject to the supplied run ID/internal fixture store, strictly validate action/transition combinations, preserve immutable audit evidence, and expose no arbitrary mutation primitive. Revoke execution from `public`, `anon`, and `authenticated`; add native PostgreSQL privilege, cross-store/run tampering, invalid-transition, idempotency, and production-mode tests. Run the strict browser suite against it before approval.

### P1 — Acceptance control can be enabled in a non-Vercel production runtime

Evidence:

- `apps/web/app/api/internal/digital-products/acceptance/route.ts:9-13` returns 404 only when `VERCEL_ENV === "production"` or `MYRIVO_DIGITAL_ACCEPTANCE_ENVIRONMENT` is not `test|preview`.
- It does not reject `NODE_ENV === "production"`, an application deployment environment identifier, or a production hostname/origin.
- On any self-hosted/container production runtime where `VERCEL_ENV` is absent, setting or leaking `MYRIVO_DIGITAL_ACCEPTANCE_ENVIRONMENT=test` enables a bearer-authenticated endpoint backed by the unrestricted Supabase service role (`apps/web/lib/digital-products/acceptance-control.ts:15-27`).
- The route tests cover Vercel production and missing acceptance configuration, but not `NODE_ENV=production` without `VERCEL_ENV`, production hostnames, or production Supabase targets.

Impact:

A configuration error could expose an endpoint capable of resetting/injecting delivery, refund, and dispute state in production. Its separate 32-character bearer is valuable defense, but it is not an acceptable sole barrier for a service-role-backed destructive test control.

Required remediation:

Fail closed when `NODE_ENV === "production"`, when any deployment/environment marker is production, or when the resolved external app/Supabase target is not an explicit allowlisted non-production target. Require all guards simultaneously: dedicated acceptance build flag, explicit approved non-production host/project ID, control secret, and run-scoped fixture identity. Enforce the non-production/store/run invariant again inside the database RPC so route configuration cannot bypass it. Add tests for self-hosted production, production host/project, missing/malformed environment markers, and a valid preview fixture.

## P2 observations

### P2 — Evidence authentication shares the acceptance-control bearer

`apps/web/e2e/digital-products-fixture.ts:34-39` signs evidence with `fixture.controlSecret`, and the same secret authorizes the mutation/observation endpoint. Compromise of one credential permits both state manipulation and evidence signing. Use a distinct CI-held evidence-signing key or asymmetric signing, and never deliver that signing credential to the deployed acceptance application/fixture.

### P2 — Evidence completeness checks are count-based

`scripts/verify-digital-products-acceptance.mjs:40` requires only five observations, while the suite and approved matrix contain many named transitions. Although Playwright assertions provide some coverage, the final signed artifact should require the exact scenario/action set, unique ordered actions, provider IDs, subject/run binding, test-mode provider state, and reviewer outputs before its digest can populate a production approval.

## Verified resolutions

- Migration versions `20260813021000` and `20260813022000` are unique and monotonically follow the existing chain; the new repository contract rejects duplicate version prefixes.
- Native PostgreSQL coverage now verifies secure-session RPC existence/privileges and exact approval/runtime matching, mismatched release/digest, revocation, expiry/window, review timestamps, and application-role denial.
- `authorize_digital_download_session` is service-role-only and rechecks token expiry, revocation, and payment eligibility.
- Release approval is bound to exact runtime release version, evidence digest, and production target environment; it remains current, unrevoked, and bounded to seven days.
- Main-target pull requests run the strict gate before merge. Fixture targets are constrained to loopback or an explicit HTTPS non-production host; current-run evidence is SHA/run/origin-bound and HMAC-verified.
- Prior bearer leaks remain fixed: APIs return `/downloads`, fragment bootstrap is memory-only, and grants use trusted-origin POST.
- Focused/full tests reported by the fix passed, including 130 native migration tests. Official Supabase fresh/upgrade validation is still externally blocked by unavailable Docker and remains mandatory before rollout.
- Real Stripe/Resend acceptance is not claimed and must continue to block approval.

## Review scope

Reviewed diff `10a59ba..14cafc6`, migration filenames and contracts, secure-session/release-approval SQL and native tests, acceptance route/service/schema/tests, Playwright fixture/actions, evidence verifier, CI materialization/host constraints, runbook, and prior credential/session fixes. No implementation file was changed.
