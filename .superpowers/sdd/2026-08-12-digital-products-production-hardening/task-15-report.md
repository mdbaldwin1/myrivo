# Task 15 Report — Release Validation and Operations

## Outcome

Implemented the repository-side security, accessibility, performance, end-to-end acceptance harness, and production operations documentation for digital products. All executable local quality gates pass. The real provider acceptance gate remains intentionally incomplete because this worktree has no test environment file, test Supabase project, Stripe test credentials, Resend test credentials/recipient, or seeded acceptance fixture. No production service was queried or mutated, and no acceptance evidence was fabricated.

The feature must remain disabled for non-internal stores until the external acceptance matrix and three independent final reviews are complete.

## Changed files

- `apps/web/tests/digital-products-release-security.test.ts`
  - Release contract coverage for trusted origin, authentication, tenant ownership, strict UUID parsing, direct signed uploads, post-upload byte/signature verification, bounded image decoding, throttling, no-store responses, token hashing, private-path exclusion, and required query indexes.
- `apps/web/e2e/digital-products.spec.ts`
  - Gated non-production acceptance journeys for merchant readiness, digital-only and mixed buyer flows, secure/expired access, customer/merchant order states, and redacted state-transition evidence.
- `apps/web/e2e/digital-products-accessibility.spec.ts`
  - Gated mobile and desktop axe coverage over catalog/files, product, cart, checkout return, downloads, recovery, customer order, and merchant order, plus reduced motion, keyboard focus/status semantics, control names, and 200% zoom.
- `docs/runbooks/digital-products.md`
  - Environment, secrets, storage policy, worker schedule, migrations, rollback, rollout, real-provider acceptance, repair, revocation, reconciliation, alerting, support language, and leaked-link response.
- `apps/web/content/docs/catalog-and-orders.md`
  - Buyer/merchant help for immutable versions, delivery recovery, support privacy, and neutral recovery behavior.
- `CHANGELOG.md`
  - User-visible release-readiness entry.

## TDD evidence

The new security contract suite was first run with two failing assertions. Inspection showed the implementation uses an in-house bounded magic-byte detector rather than a `file-type` dependency and names its shared recovery response wrapper `hardenedJson`; the assertions were corrected to validate the actual protections (`detectMimeType`, `content_signature_mismatch`, `NEUTRAL_RESPONSE`, and no-store headers). The focused suite then passed 9/9.

## Validation

- `git diff --check` — passed.
- `npm run -w @myrivo/web test -- --run tests/digital-products-release-security.test.ts` — passed, 9 tests.
- `npm run -w @myrivo/web typecheck` — passed.
- `npm run -w @myrivo/web lint` — passed with consistency checks.
- `npm run -w @myrivo/web e2e -- --list digital-products.spec.ts digital-products-accessibility.spec.ts` — compiled and listed 12 tests.
- `E2E_MANAGED_SERVER=false npm run -w @myrivo/web e2e -- digital-products.spec.ts digital-products-accessibility.spec.ts` — harness passed with 12 explicitly skipped because no non-production acceptance fixture was configured. This is not counted as provider acceptance.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — passed, 266 files / 1,091 tests, including native PostgreSQL migration and concurrency suites.
- `npm run build` — passed, 162 pages generated.

## External acceptance blocker

Read-only prerequisite checks found `.env.local`, `.env.local.test`, and `apps/web/.env.local` absent. `node scripts/assert-test-store.mjs --env-file=.env.local.test` stopped with `.env.local.test: not found`. Therefore this session could not safely establish a non-production Supabase target or use Stripe test mode and a Resend-authorized recipient.

Still required before rollout:

1. Provision a dedicated non-production Supabase project with all migrations and an internal eligible/flagged store.
2. Configure Stripe test keys/webhook secret with `STRIPE_STUB_MODE=false`, Resend test credentials/sender/recipient, worker secrets, and owner fixture credentials in `.env.local.test`.
3. Seed the fixture paths described by `MYRIVO_DIGITAL_ACCEPTANCE_FIXTURE` and a redacted evidence record at `MYRIVO_DIGITAL_ACCEPTANCE_EVIDENCE`.
4. Run the two digital Playwright specs with zero skipped tests and record successful provider IDs/screenshots for every runbook matrix item.
5. Complete independent security, code-quality, and UX/accessibility reviews; resolve every P0/P1 and document any accepted P2.

## Risks and release stance

- The E2E specs deliberately fail closed by skipping without an explicit non-production fixture; a skipped run is visible and is not sufficient for release approval.
- Provider/webhook/email behavior has strong unit/integration and PostgreSQL concurrency coverage but still needs a real network/provider exercise.
- Mobile/desktop axe, zoom, focus, and reduced-motion checks compile but require the seeded browser environment to execute.
- Keep both plan and store rollout gates disabled outside the internal acceptance cohort until all remaining gates are recorded.
