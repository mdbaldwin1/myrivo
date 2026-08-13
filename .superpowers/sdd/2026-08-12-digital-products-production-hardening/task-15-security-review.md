# Task 15 Independent Security Re-review — Round 5

## Verdict

**FAIL — two P1 release-gate defects remain.** The RPC now exists, uses unique migration version `20260813023000`, is service-role-only, and meaningfully enforces active run/store/project binding, action/transition validation, and idempotency. Evidence signing is separated from control authentication. However, the deployed acceptance endpoint is disabled in the environment where it must run, and the gate can certify synthetic database financial transitions as real provider acceptance.

## Findings

### P1 — The acceptance route is unavailable on normal deployed preview builds

Evidence:

- `apps/web/app/api/internal/digital-products/acceptance/route.ts:13-15` returns 404 whenever `NODE_ENV === "production"`.
- Next.js production builds and deployed Vercel preview deployments normally run with `NODE_ENV=production`; `VERCEL_ENV=preview` distinguishes the deployment tier.
- The strict verifier permits an explicitly approved remote HTTPS non-production host and sets `E2E_MANAGED_SERVER=false`, so its intended deployment target is a built preview application. That target will always reject the control route before its preview/environment/origin/project/credential checks.
- The route test changes `VERCEL_ENV` but does not model a deployed preview with `NODE_ENV=production`, so it misses this contradiction.

Impact:

The real remote Stripe/Resend acceptance suite cannot execute against the intended preview deployment even with all credentials and fixture state present. This is fail-closed but blocks the only path to a valid release approval.

Required remediation:

Do not use `NODE_ENV` alone to distinguish preview from production. Require a conjunction of independently validated controls: `VERCEL_ENV === "preview"` (or a supported explicit deployment tier), exact allowlisted app origin, exact non-production Supabase project reference/URL, explicit acceptance-build flag, run-scoped target, and control credential. Reject `VERCEL_ENV=production` and unknown/self-hosted tiers by default. If self-hosted acceptance is supported, require a separate immutable deployment-tier value and project allowlist. Add tests for deployed preview (`NODE_ENV=production`, preview tier) succeeding and production/unknown tiers failing.

### P1 — The gate treats synthetic database refund/dispute transitions as provider acceptance

Evidence:

- `supabase/migrations/20260813023000_nonproduction_digital_acceptance_control.sql:57-67` creates refunds with fabricated `re_acceptance_*`/`evt_acceptance_*` identifiers and directly calls `sync_refund_digital_access`; dispute actions similarly fabricate `dp_acceptance_*`/`evt_acceptance_*` values and directly call `sync_dispute_digital_access`.
- `apps/web/e2e/digital-products.spec.ts:68-84` labels these as “provider financial events” and uses them for partial/full refund and opened/won/lost dispute acceptance.
- `scripts/verify-digital-products-acceptance.mjs:43-49` requires those synthetic action names but only checks `providerPayment` is a succeeded, non-live Stripe payment. It does not require Stripe refund IDs/events, dispute IDs/events, webhook receipt/processing evidence, or authoritative provider refund/dispute state for each transition.
- The signed evidence can therefore satisfy the release gate and populate a production-bound approval without ever exercising Stripe's refund/dispute APIs, webhooks, signature verification, retry delivery, or event ordering.

Impact:

The release interlock can attest to a critical financial-security path that was never tested against the provider. Defects in webhook verification, metadata mapping, retries, ordering, or provider payload handling could reach production behind a seemingly valid approval.

Required remediation:

Use Stripe test-mode APIs/events for refund acceptance and the provider-supported test path for disputes; drive the real webhook endpoint and verify recorded Stripe test IDs, signed event receipt, durable processing, and final authoritative provider state. If Stripe cannot inject a required dispute transition, keep that scenario explicitly blocked/manual and prevent generation of a complete production approval—do not substitute direct database state changes. Reserve DB injection only for clearly labeled internal resilience tests excluded from provider-acceptance evidence. Make the evidence schema/verifier require scenario-specific provider event/object IDs and correlated webhook/application records.

## P2 observations

### P2 — Database non-production enforcement trusts caller-supplied environment/project strings

The RPC compares `p_environment` and `p_project_ref` with `digital_acceptance_targets`, but does not independently derive them from a database deployment setting. A service-role caller can provide the stored values. Route and credential controls mitigate this, yet the claimed database-side production guard is weaker than documented. Bind the RPC to immutable database settings/project identity or use a dedicated limited database role available only in the acceptance project.

### P2 — `reset` records success without resetting fixture state

The action allowlist includes `reset`, but the SQL action body has no reset branch; it only inserts an audit result. This can make serial browser runs depend on prior state. Implement a narrow deterministic fixture reset or remove the action and provision a fresh run fixture externally.

## Verified resolutions

- Migration versions are unique and covered by a repository-wide uniqueness test.
- `acceptance_control_digital_products` exists, validates action/transition pairs, locks an active unexpired run target, rejects cross-run/cross-store/project mismatch, and records one result per run/idempotency key.
- RPC execution is revoked from public/anon/authenticated and granted only to service role; acceptance tables have RLS and no application-role privileges.
- Native PostgreSQL tests exercise privileges, production-string/project/run/store tampering, invalid transitions, and idempotent audit recording.
- Route authentication uses timing-safe hashed comparison and requires explicit environment, exact origin, and project-format configuration before service-role work.
- Evidence uses a separate CI HMAC key and rejects reuse of the control secret. Required action names, run/order/origin/release binding, recent completion, and non-live succeeded payment are checked.
- Prior bearer/session/POST/origin/release-approval fixes remain intact.
- Focused acceptance-control/evidence/migration-version tests passed: 3 files, 7 tests. Full validation was reported as 1,103 tests plus lint/typecheck/build.
- Docker/Supabase official reset and real Stripe/Resend availability remain external rollout blockers and are not classified as code defects here.

## Review scope

Reviewed diff `a25e377..8e43d02`, acceptance migration/RPC, native migration tests, route guards/authentication, service observation, browser financial journeys, evidence signing/verifier, CI secrets, and prior session/release controls. No implementation file was changed.
