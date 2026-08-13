# Task 15 Independent Security Re-review — Round 6

## Verdict

**FAIL — one P1 provider-acceptance defect remains.** Preview/production routing, bearer/session handling, database target binding, and evidence-key separation are materially improved. Synthetic financial transitions now fail closed, but the browser gate still invokes them and the verifier still lacks scenario-specific provider proof. Docker and unavailable real-provider fixtures remain external blockers and are not classified as code defects.

## Finding

### P1 — The strict financial acceptance path is internally contradictory and cannot certify real Stripe transitions

Evidence:

- `supabase/migrations/20260813023000_nonproduction_digital_acceptance_control.sql:60-62` correctly rejects `inject-refund` and `inject-dispute` with `acceptance_control_provider_event_required`; it no longer fabricates provider IDs or directly certifies state.
- Nevertheless, `apps/web/e2e/digital-products.spec.ts:88-106` still calls `acceptanceAction(..., "inject-refund", ...)` and `acceptanceAction(..., "inject-dispute", ...)` before observing the financial fixture orders.
- The control route converts the intentional database rejection into HTTP 500, and `apps/web/e2e/digital-products-fixture.ts:30-32` throws on any non-2xx response. Thus the release suite deterministically stops even if the fixture orders have already received valid Stripe test-mode refund/dispute webhooks.
- The verifier at `scripts/verify-digital-products-acceptance.mjs:43-55` requires scenario labels such as `stripe-partial-refund` and `stripe-dispute-won`, but at lines 52-53 validates only subject linkage and the original payment intent's succeeded/non-live status. It does not require a real Stripe refund/dispute object/event ID, signed webhook receipt, processed event record, provider state, or correlation to the scenario/order.

Impact:

The code has no executable path to complete the documented provider gate. Simply removing the failing action calls would then permit signed scenario evidence based on application state plus the original payment, without proving that Stripe produced or delivered the refund/dispute event. The release approval would either be impossible to generate or too weak to support its provider-acceptance claim.

Required remediation:

Drive supported refunds through Stripe test-mode APIs and disputes through a documented provider-supported test mechanism outside the database mutation RPC. For pre-provisioned provider scenarios, change the browser test to observation-only and make the control service retrieve and return scenario-specific Stripe refund/dispute objects plus correlated persisted webhook event/processing records. Extend the signed evidence schema and verifier to require exact provider object/event IDs, `livemode=false`, expected provider status/amount/order linkage, webhook signature/receipt identity, and final application transition for every financial scenario. If Stripe cannot generate a required dispute state, explicitly keep that scenario and production approval blocked; do not call a deliberately rejected RPC as the mechanism.

## P2 observations

### P2 — Database GUC provisioning is operationally underspecified

The RPC now requires `current_setting('app.acceptance_environment')` and `current_setting('app.acceptance_project_ref')` to match the request and target, which is useful defense in depth. The application does not set these values per transaction; they must be provisioned on the acceptance database/role. The runbook mentions the requirement but gives no concrete, verified least-privilege provisioning/rollback command. Add a preview-only provisioning step and a startup/health check proving the PostgREST service-role session sees the expected immutable values.

### P2 — Resend retrieval should be provider- and run-bound in final evidence

The suite retrieves a message by recipient plus order ID and validates a safe fragment URL, which is meaningful. The final verifier does not require the Resend message ID, sender/domain, delivery status, run time, or order linkage in the signed artifact. Add these fields and reject stale messages from earlier runs.

## Verified resolutions

- A deployed Vercel preview with `NODE_ENV=production` is allowed only when `VERCEL_ENV=preview`, the acceptance build flag is enabled, and environment/origin/project/secret checks pass. Vercel production and unknown/self-hosted production fail closed. Tests cover this distinction.
- The database RPC requires configured GUC environment/project identity plus active unexpired target/run/store binding and rejects cross-store, cross-run, project mismatch, invalid transitions, and unsupported provider-event injection.
- RPC and acceptance tables remain service-role-only/application-role inaccessible, with idempotent action audit rows.
- Financial orders are split across mutually exclusive fixture branches, and observations bind dynamic checkout order IDs rather than assuming one static subject.
- Resend access retrieval matches recipient and order, rejects missing/unsupported retrieval, validates a fragment bearer rather than path credential, and exercises it in a clean browser context.
- Evidence signing uses a distinct CI-held HMAC key and rejects control-key reuse. Origin/run/release/subject and exact scenario labels are signed and checked.
- Prior no-bearer public API/path, safe fragment retry, POST/origin, migration uniqueness, and exact production approval/runtime controls remain intact.
- Focused route/evidence/migration-version suites passed: 3 files, 8 tests; the fix report records 1,104 full tests plus lint/typecheck/build.
- Official Supabase Docker verification and real Stripe/Resend execution remain external rollout blockers and must still be completed.

## Review scope

Reviewed diff `4c4c780..fb5720c`, preview/production route tests, acceptance RPC/GUC/privilege behavior, dynamic checkout and Resend browser flows, financial scenario calls, observation/evidence binding, verifier requirements, runbook, and all prior security findings. No implementation file was changed.
