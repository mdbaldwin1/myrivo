# Digital Products Operations Runbook

Owner: Commerce Engineering  
Review cadence: Quarterly and after every delivery/security incident  
Last reviewed: August 13, 2026

This runbook is the production operating procedure for native digital products. The feature is default-off and must stay disabled for non-internal stores until the release checklist, real Stripe/Resend acceptance, and independent security, code, and UX reviews are complete.

## Invariants

- A published digital product has a rights affirmation, a ready public watermarked preview, and at least one ready applicable immutable file for every active variant.
- Checkout locks the exact asset versions the buyer saw. Replacement never changes prior buyers' files.
- Original files stay in the private `digital-product-assets` bucket. Only bounded watermarked previews live in `digital-product-previews`.
- Access bearers and signed storage URLs are never persisted or logged. Emailed bearers are held in a URL fragment, exchanged once by POST for a signed HttpOnly session, and immediately removed from browser navigation; list and grant URLs contain no credential. Only keyed hashes and opaque IDs are stored.
- Access links last 48 hours. Each entitlement allows exactly five successful grants; a 60-second same-session grace retry does not consume another grant.
- Partial refunds preserve access. Cumulative full refunds revoke it. Open disputes suspend access, wins restore it, and losses revoke it.
- Disabling rollout blocks new sales, not delivery or support for already-paid orders.

## Required configuration

Configure and validate these separately in preview and production. Never copy production secrets into local fixtures.

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Stripe: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`; `STRIPE_STUB_MODE=false` for acceptance and production.
- Email: `RESEND_API_KEY`, verified platform sender/domain, and an authorized test recipient for acceptance.
- Digital workers: independent 32+ character `DIGITAL_DELIVERY_PROCESS_SECRET`, `DIGITAL_DELIVERY_TOKEN_SECRET`, and `DIGITAL_DOWNLOAD_SESSION_SECRET`.
- Recovery ingress: Vercel supplies its trusted forwarding identity. Outside Vercel, set `DIGITAL_RECOVERY_TRUSTED_IP_HEADER` only after the edge strips client copies and injects a validated address.
- App URL and ordinary platform variables documented in `docs/env-matrix.md`.

Keep token and session secrets stable during normal deploys. Rotation invalidates active links or browser grace sessions; follow the incident procedure below when rotation is intentional.

## Storage policies

`digital-product-assets` is private. Browser uploads use short-lived, single-object signed upload intents; application APIs never proxy the file body. Service role alone may list, sign, verify, or remove originals. No public read policy is permitted.

`digital-product-previews` contains only generated, metadata-free, reduced-resolution watermarked JPEGs. Public reads are allowed; writes and deletion remain service-role-only. A preview path is bound to store, product, source version, and processing generation.

After deployment, verify bucket visibility in a non-production project: an anonymous original read must fail, a public preview read must succeed, an expired upload signature must fail, and completing an intent with spoofed MIME/signature/size must fail.

## Worker schedule

Schedule `POST /api/internal/digital-delivery/process` every minute with `Authorization: Bearer <DIGITAL_DELIVERY_PROCESS_SECRET>`. Use a platform scheduler that retries transport failures. The worker uses leases, bounded batches, and exponential backoff, so overlapping invocations are safe.

Alert when the scheduler has no successful invocation for five minutes, paid delivery is pending over five minutes, the same repair generation reaches three failures, provider email attempts repeatedly fail, or access reconciliation reports a mismatch. See `/dashboard/admin/digital-products` for privacy-safe issue codes and bounded dimensions.

## Migration and rollout

1. Take a schema backup and confirm the current application can tolerate additive digital tables.
2. Apply migrations in timestamp order, beginning with `20260812170000_native_digital_products.sql` and including every later digital hardening migration. Never cherry-pick only the first schema migration.
3. Run the migration integration suite and the health RPC as service role. Confirm public, anonymous, and authenticated roles cannot execute service-only lifecycle functions.
4. Deploy application code with every plan ineligible and every store disabled.
5. Verify worker authentication, bucket policies, privacy-safe operations UI, and alerts.
6. Enable `digitalProducts: true` on one internal test plan, then enable one internal flagged store through the idempotent admin operation.
7. Complete the acceptance matrix below. Observe one complete retry window before enabling another cohort.

Promotion runs `npm run verify:digital-products-release` on the PR targeting `main`, before merge. It fails closed unless the fixture, current-run provider-linked evidence, Stripe test-mode credentials, Resend test recipient, and all executable digital Playwright journeys are present. The fixture origin is forced into Playwright and must be loopback or the explicitly approved HTTPS non-production host; every route and the acceptance-control endpoint is same-origin. The successful evidence digest, exact release SHA, production target, and three review timestamps must be recorded in `digital_products_release_approvals` and matched by `digital_products_release_runtime`; the database rejects rollout enablement for stale, mismatched, future-dated, over-seven-day, revoked, or expired approval. A skipped test is never approval.

Rollback starts by disabling every enabled store. Roll back application code only after flags are off. Leave additive tables, immutable manifests, jobs, entitlements, grants, tokens, and audit records in place so paid buyers retain support. Do not reverse migrations that would discard order evidence. If schema rollback is unavoidable, stop checkout, back up affected tables, and obtain engineering/security approval.

## Acceptance matrix and evidence

Run against a dedicated non-production store with Stripe test mode and a Resend-authorized recipient. Point `MYRIVO_DIGITAL_ACCEPTANCE_FIXTURE` at the versioned fixture and `MYRIVO_DIGITAL_ACCEPTANCE_EVIDENCE_OUTPUT` at a new empty temporary path. The browser run performs user-facing merchant/buyer actions; the separately authenticated control endpoint is limited to deterministic reset, provider-event/failure injection, and independent state observation. It returns 404 in production. The run generates its own SHA/environment/run-bound HMAC evidence; static or pre-created evidence is rejected.

Record timestamps and safe IDs (store/order/job/manifest IDs are acceptable internally), Stripe test event IDs, Resend delivery IDs, screenshots, and observed states for:

- digital-only and mixed successful payments;
- duplicated/retried webhook convergence;
- initial email, access page, and storage redirect;
- five grants, deterministic same-session grace reuse, and sixth-grant rejection;
- expired-link recovery and merchant resend with rotated links but unchanged grant counts;
- replacement with the original buyer still receiving the purchased version;
- partial and cumulative-full refund transitions;
- dispute opened, won, and lost transitions;
- injected email/delivery failure followed by durable retry convergence.

Redact email addresses, IP addresses, bearer tokens, signed URLs, object paths, API keys, and provider payload bodies. Never mark this gate complete from stub-mode, mocks, unit tests, or a skipped Playwright suite.

## Delivery repair and reconciliation

1. Find the safe issue code and order/job identifiers in Digital Product Operations.
2. Confirm the manifest is locked and payment completed. Never reconstruct files from the current catalog.
3. If work is retryable, use **Requeue delivery** once with a unique idempotency key. A repair generation receives a fresh bounded attempt budget while global attempt history remains immutable.
4. If delivery succeeded but the email was lost, use **Resend link**. It rotates only the active order token and does not reset grants.
5. If refund/dispute state differs from entitlements, use **Reconcile access** and verify the resulting audit event.
6. Observe the next worker attempt and provider result. Escalate repeated failure rather than repeatedly requeueing.

Never edit a manifest, entitlement counter, token row, or delivery attempt directly. Database repairs require an approved incident change with before/after queries and a rollback statement.

## Token revocation

For one order, use the supported full-refund/dispute/reconciliation path or an approved service-role repair to revoke active order tokens and entitlement access transactionally. For a leaked link, revoke every active token for the order, queue a fresh link only after buyer identity is verified, and inspect grant history for unexpected sessions.

For suspected platform-secret compromise, disable new digital sales, rotate the affected secret in all environments, restart workers, and treat all active bearers derived from the old token secret as compromised. Bulk revoke active tokens using an approved audited migration/repair; notify affected buyers with fresh links. Rotating only `DIGITAL_DOWNLOAD_SESSION_SECRET` invalidates grace sessions but not access links.

## Financial reconciliation

Compare each paid digital order's latest authoritative Stripe refund/dispute tuple with its entitlement and token state. The reconciler must be idempotent and source-order-aware. A partial refund remains active; a cumulative full refund is revoked; a current open dispute is suspended; a win restores only the state attributable to that dispute; a loss revokes it. Investigate source ordering or missing webhook delivery before forcing state.

## Customer-support scripts

**Link expired or email missing:** “For your security, download links expire after 48 hours. Visit the secure recovery page and enter the complete order ID and purchase email. If they match, we’ll send a fresh link. This does not reset download limits.”

**Grant limit reached:** “This file has reached its five successful download grants. We’ll review the order and download history. Please do not send the original file or a link in email.” Escalate for an audited entitlement decision; support must not increment counters directly.

**File appears defective:** “I’m sorry the file isn’t working as expected. Please tell us the displayed filename, format, and error—do not attach purchased content. We’ll verify the immutable version attached to your order and apply the digital refund policy.”

**Refund/dispute access:** “Digital access follows the payment status. Partial refunds normally preserve access, full refunds revoke it, and an open dispute temporarily suspends it. We’ll recheck the payment event and restore access automatically when appropriate.”

Support tickets may contain order ID and store ID, but never bearer links, signed URLs, token hashes, object paths, raw provider payloads, IP addresses, or secrets.

## Leaked-link incident response

1. Acknowledge and open a security incident; do not paste the link into chat, analytics, or ticket fields.
2. Disable new sales only if scope is systemic. Preserve paid-order delivery and evidence.
3. Revoke affected active token rows and sessions through an audited repair. Do not delete grant history.
4. Determine exposure from hashed token lookup, grant timestamps, opaque session fingerprints, and safe audit events. Avoid deanonymizing buyers unless required.
5. Verify originals remained private and no storage signature appeared in application logs.
6. Send the verified buyer a newly rotated link if access remains financially eligible.
7. Rotate platform secrets and bulk-revoke tokens if compromise is systemic.
8. Document timeline, scope, buyer impact, containment, recovery, and follow-up controls; apply breach-notification procedures when required.

## Release and incident commands

Run from the repository root:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run -w @myrivo/web e2e -- digital-products.spec.ts digital-products-accessibility.spec.ts
```

The final command is a real acceptance gate only when the fixture, fresh evidence output path, approved non-production host, and provider credentials are present and no tests are skipped. Keep the feature off if Stripe/Resend credentials, a non-production backend, official Supabase fresh/upgrade verification, migrations, or reviewer approval are unavailable. Native PostgreSQL tests validate migration behavior locally, but do not replace an official Supabase reset/upgrade run.

Related procedures: `docs/runbooks/digital-products-rollout-operations.md`, `docs/runbooks/refunds-disputes-operations.md`, `docs/runbooks/deployment-vercel.md`, and `docs/env-matrix.md`.
