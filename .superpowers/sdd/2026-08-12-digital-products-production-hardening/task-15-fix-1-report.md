# Task 15 Fix Round 1

Resolved the three independent review reports' P1 findings and actionable P2s.

## Security architecture

- Access bearers now appear only in the email URL fragment (`/downloads#token=...`), which is not sent in HTTP request targets.
- The download client removes the fragment immediately and exchanges the bearer once in a same-origin POST body.
- Exchange returns a signed HttpOnly, SameSite session cookie containing opaque browser-session and database access-token IDs. List and grant paths contain no bearer, and every request re-authorizes the opaque access ID against expiry/revocation/payment state through a service-role-only RPC.
- Legacy bearer path page/API routes were removed. Checkout, recovery, resend, and authenticated access emit fragment URLs.
- Behavioral route tests cover hostile origin, malformed body credentials, neutral invalid access, hashed database lookup, no bearer echo, and hardened responses.

## Release interlock

- `npm run verify:digital-products-release` fails unless a non-production fixture, structured scenario evidence, Stripe test mode, Resend recipient, and provider credentials are configured; it then runs only the digital suites in required mode.
- Main-branch CI invokes the strict promotion gate.
- Structured evidence requires scenario IDs, provider event linkage, application state, and run timestamps; free-form phrases cannot satisfy it.
- `digital_products_release_approvals` records evidence digest, environment, provider acceptance, three review timestamps, approver, expiry, and revocation. A database trigger rejects rollout enablement without a current complete approval.

## UX/accessibility

- Both continuous download spinners honor reduced motion.
- File download preparation now clears after a bounded interval and announces start/retry feedback.
- Acceptance coverage uses distinct customer/merchant identities, checks 200% horizontal reflow/action reachability, and asserts reduced-motion computed animation state.

## Validation

- Strict release gate without credentials: failed as required with `acceptance fixture is missing`.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 266 files / 1,082 tests passed, including 122 native PostgreSQL migration tests and 29 grant concurrency tests.
- `npm run build`: passed; 164 routes/pages generated and no bearer-path download route exists.
- Digital Playwright specs compile; real provider/browser execution remains blocked by absent non-production credentials/fixture and is not claimed.

`bd` is unavailable in this environment, so issue synchronization could not run.
