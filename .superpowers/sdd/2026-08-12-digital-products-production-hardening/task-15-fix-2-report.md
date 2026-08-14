# Task 15 Fix Round 2

Resolved the second independent security, code, and UX review findings.

## Credential and download security

- Checkout status and authenticated-customer APIs now establish the opaque download session server-side and return only `/downloads`; raw bearer credentials are never serialized by those APIs.
- Fragment bootstrap credentials are removed from browser history immediately, retained only in memory across a transient exchange failure, and cleared after a successful exchange.
- Download grants are same-origin POST operations. Hostile-origin requests are rejected before database or audit work.
- Download feedback is driven by the hidden response frame's observed load/result instead of an unconditional success timer.

## Executable acceptance and release binding

- The Playwright acceptance suite now invokes deterministic fixture actions and validates authoritative catalog, payment, delivery, grant, recovery, replacement, refund, dispute, retry, and resend states.
- Fixtures are schema-validated, bound to `E2E_BASE_URL`, restricted to loopback or an explicitly approved HTTPS non-production host, and require same-origin routes.
- Strict acceptance runs on `main` and on pull requests targeting `main`, before merge.
- Acceptance evidence is versioned and bound to the fixture run ID, exact origin, commit SHA, evidence digest, and a recent completion window.
- The database rollout interlock requires an unexpired production approval whose exact release version, environment, and evidence digest match the deployed runtime record.

## Accessibility and UX

- Keyboard coverage verifies visible, ordered focus and Enter-key activation.
- Recovery validation checks the specific live error, focus movement, and post-error axe state.
- Reduced-motion coverage observes the active loading state and verifies its computed animation is disabled.

## Validation

- Strict release gate without credentials: failed closed as required with `acceptance fixture is missing`.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 266 files / 1,084 tests passed, including 122 native PostgreSQL migration tests and 29 grant concurrency tests.
- `npm run build`: passed; 164 routes/pages generated.
- Playwright acceptance and accessibility specs compile: 13 tests listed.
- Real provider/browser acceptance remains blocked by absent non-production fixture, control endpoint, and provider credentials; no external acceptance is claimed.

`bd` is unavailable in this environment, so issue synchronization could not run.
