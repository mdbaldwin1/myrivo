# Task 9 Report: Atomic Digital Download Grants

## Status

Complete on `codex/digital-products`. Digital download access is now authorized at one service-role database boundary, each entitlement permits exactly five successful grants, one issued grant can be reused for 60 seconds only by the same access token and opaque browser session, and every post-reservation failure releases capacity without consuming a grant.

## Implementation

### Authoritative access and safe listing

- Added `authorize_digital_download_access(token_hash)` as the sole bearer-token authorization boundary. It requires a current, unrevoked token, authoritative order/store binding, a paid order, no successful full refund, and no open or lost dispute.
- Added `list_authorized_digital_downloads(access_token_id)` for path-free customer metadata. It returns only entitlement ID, customer filename, MIME type, byte size, status, and remaining grants; the route adds only the access expiry timestamp.
- Absent, expired, revoked, fully refunded, and disputed access links share one neutral public response. Database/provider details are never returned or logged.
- Existing purchase, merchant-resend, and random 32-byte access links remain compatible through the exact 43-character base64url token contract.

### Five-grant reserve/commit/release protocol

- Added forward migration `20260813010000_atomic_digital_download_grants.sql`; the prototype and earlier hardening migration remain unchanged.
- The migration refuses to normalize already-over-limit data silently, normalizes safe entitlements to exactly five grants, and adds the database check `max_download_grants = 5`.
- Reserve locks the entitlement, validates token/order/store/access eligibility, expires stale reservations, reuses an eligible same-token/same-session issued or reserved row, includes live reservations in quota, and otherwise creates one five-minute reservation without incrementing usage.
- Commit locks both grant and entitlement, revalidates token and access eligibility, increments `download_grants_used` only once, and records an exact 60-second grace window.
- Release is idempotent for released and already-issued rows; it never decrements or increments the entitlement counter.
- Grace reuse is bound to both the currently authorized access-token ID and a session fingerprint. Rotating/revoking a bearer link cannot accidentally reuse its prior grace grant in the same browser.

### Server-side signing and session privacy

- Added the typed `download-service.ts` boundary exporting `authorizeAccessToken()`, `reserveDownloadGrant()`, `commitDownloadGrant()`, and `releaseDownloadGrant()` plus the composed signing flow.
- The application looks up the immutable version using version, asset, product, and store identity, then signs the private object server-side for the configured 300 seconds, and commits only after a valid signed URL exists.
- Asset lookup error/rejection, signing error/rejection, commit error/rejection, and malformed dependency responses all take the single finally-based release path. Cleanup rejection cannot mask the generic primary error.
- The 60-second reuse fingerprint is SHA-256 over an opaque random `HttpOnly`, `SameSite=Lax` session UUID. It contains no IP address, user agent, bearer token, order ID, or access-token ID and remains stable across network/browser-header changes for that cookie.
- A new session cookie is set only when absent/invalid, is `Secure` in production, and expires with the platform-owned 48-hour access window.

### Public route hardening

- Both list and grant routes require strict token syntax; the grant route also requires a UUID entitlement before any database access.
- Both routes use the repository's shared Postgres `check_api_rate_limit` RPC. Bucket keys persist only a SHA-256 request-address identifier, never the raw address or bearer token. The route fails closed if the shared limiter is unavailable rather than relying on per-instance memory.
- All responses and redirects set private `no-store`, no-cache, CSP default-deny, `nosniff`, no-referrer, frame-deny, and same-origin resource headers.
- Signed URLs appear only as the immediate 303 `Location`; they are never persisted, emailed, listed, logged, or included in errors.

## TDD Evidence

### RED

- The new route suite initially failed 20/20 because the old routes queried access/token tables directly and had no authorization/list RPCs, shared throttle, opaque session fingerprint, strict path validation, safe list shape, or complete security headers.
- The native PostgreSQL suite initially stopped on the deliberately missing forward migration.
- After adding the migration, early real-Postgres cases rejected non-UUID test reservation labels, proving the new strict internal idempotency identifier contract before fixtures were corrected to actual UUIDs.
- A late self-review regression reproduced a real rotated-link defect: the same browser session selected a grace grant from the now-revoked token and commit correctly rejected it. Adding access-token identity to grace and live-reservation reuse made the regression pass.

### GREEN

Focused final command:

```text
npm test --workspace @myrivo/web -- digital-download-concurrency.test.ts digital-download-route.test.ts digital-products-migration.test.ts
Test Files 3 passed (3)
Tests 121 passed (121)
```

The database suite covers same-session grace reuse, different-session consumption, grace expiry, rotated-token isolation, reserve/release accounting, idempotent commit, suspended/revoked entitlement denial, expired/revoked token denial, wrong-order denial, partial/full refund behavior, every open/resolved/lost dispute state, safe list shape, RPC privileges, and real fifth-grant concurrency.

The fifth-grant test runs 20 independent two-session races against native PostgreSQL 17. Every iteration has exactly one successful commit, ends at `download_grants_used = 5`, and contains exactly one newly issued grant row.

## Validation

- Focused Task 9 plus full migration chain: 3 files, 121 tests passed.
- Full web test suite: 244 files, 910 tests passed.
- `npm run lint --workspace @myrivo/web`: passed with zero warnings/errors; repository consistency checks passed.
- `npm run typecheck --workspace @myrivo/web`: passed.
- `npm run build --workspace @myrivo/web`: passed production compilation and TypeScript.
- `git diff --check`: passed.

The full suite retained only pre-existing refund/dispute mock stderr and zero-size chart warnings. The build retained the pre-existing middleware deprecation and stale Browserslist-data warnings.

## Files

- `supabase/migrations/20260813010000_atomic_digital_download_grants.sql` (new)
- `apps/web/lib/digital-products/download-service.ts` (new)
- `apps/web/app/api/digital-downloads/[token]/[entitlementId]/route.ts`
- `apps/web/app/api/digital-downloads/[token]/route.ts`
- `apps/web/lib/digital-products/config.ts`
- `apps/web/types/database.ts`
- `apps/web/tests/digital-download-concurrency.test.ts` (new)
- `apps/web/tests/digital-download-route.test.ts`
- `apps/web/tests/digital-products-migration.test.ts`
- `CHANGELOG.md`

## Operational Notes

- The migration intentionally fails if pre-deployment data already contains more than five used/issued grants for an entitlement. That state requires explicit administrative review rather than destructive normalization.
- The official Docker-backed Supabase reset remains a release/CI gate; native PostgreSQL 17 exercised the forward migration, complete repository migration chain, privileges, lifecycle behavior, and concurrency locally.

## Fix 1: Production Hardening Review

### Findings addressed

- Added forward migration `20260813011000_harden_atomic_digital_download_grants.sql`. It refuses an upgrade whenever `download_grants_used` disagrees with the authoritative issued-grant count, including the reviewed used=4/five-issued case, and installs a deferred invariant requiring `used = issued <= 5` after every transaction.
- Reserve and commit now acquire order, access-token, entitlement, and grant locks in a consistent order before sampling `clock_timestamp()`. Token expiry, reservation expiry, grace expiry, and newly written timestamps therefore use the post-wait wall clock.
- Malformed successful reserve responses now salvage and release a valid grant ID. When no grant ID can be trusted—or ID cleanup fails—the application invokes a service-role-only cleanup RPC bound to the exact entitlement, access token, reservation key, and session fingerprint.
- Download throttling no longer reads forwarding, real-IP, user-agent, or bearer-token data. It derives action-separated buckets from the opaque HttpOnly download-session fingerprint and attaches new session cookies even to rate-limited or limiter-unavailable responses.

### RED / GREEN evidence

- Route RED: three failures reproduced forwarding-header bucket bypass and both malformed-response reservation leaks. GREEN: 23/23 route tests.
- PostgreSQL RED: three real two-session tests proved stale pre-lock time accepted an expired token, committed an expired reservation, and reused an expired grace grant. The upgrade suite also stopped on the missing corrective migration.
- PostgreSQL GREEN: 27/27 concurrency tests, including used=4/five-issued upgrade rejection, direct accounting-divergence and sixth-issue rejection, exact-identity cleanup, three lock-wait expiry regressions, and 20 repeated fifth-grant races.
- Focused final: 3 files, 130 tests passed, including the 80-test complete migration-chain suite.
- Full web suite: 244 files, 919 tests passed.
- Lint, typecheck, production build, and `git diff --check`: passed.

The full suite retains only the pre-existing refund/dispute mock stderr and zero-size chart warnings. The build retains the pre-existing middleware deprecation and stale Browserslist-data warnings. The local `bd` executable was unavailable, so issue-tracker sync could not be run from this checkout.

## Fix 2: Request-Bound Cleanup and Authenticated Sessions

### Findings addressed

- Malformed reserve responses are never trusted to identify cleanup targets. The application now always invokes request-identity cleanup using only the caller-known entitlement, authorized access-token ID, generated reservation UUID, and session fingerprint.
- Added forward migration `20260813012000_bind_digital_download_cleanup_identity.sql`. Its cleanup RPC selects and locks only an exact full-identity row while it is still `reserved`; issued, released, failed, missing, or mismatched rows return `missing` without mutation.
- Replaced client-controlled UUID cookies with versioned HMAC-SHA256 download-session cookies verified with a timing-safe comparison. A dedicated stable `DIGITAL_DOWNLOAD_SESSION_SECRET` is validated as at least 32 characters and documented in `.env.example`, the environment matrix, and the Vercel deployment runbook.
- Missing, malformed, unsigned, and forged cookies all use an action-separated fallback bucket derived from the server-side bearer-token hash. They cannot mint new throttle buckets by rotating arbitrary cookie values. A valid signed cookie retains a stable per-browser bucket and session fingerprint, while separately signed browser sessions remain distinct.
- Download routes fail closed with a hardened generic 503 before database access when the signing secret is unavailable.

### RED / GREEN evidence

- Route RED reproduced six failures: signed-cookie rejection, unstable valid sessions, unsigned replacement cookies, missing-cookie bucket rotation, arbitrary UUID bucket rotation, and swapped malformed responses releasing the returned grant ID.
- PostgreSQL RED proved exact cleanup of an already-issued reservation returned `issued` instead of behaving as a reserved-only cleanup boundary.
- Focused GREEN: 4 files, 147 tests passed, including 27 route tests, 11 environment tests, 29 native PostgreSQL grant tests, and the 80-test full migration-chain suite.
- Full web suite: 244 files, 926 tests passed.
- Lint, typecheck, production build, and `git diff --check`: passed.

The full suite and build retain the same pre-existing warnings documented above. The local `bd` executable remains unavailable.

## Fix 3: Aggregate Bearer Throttling

### Findings addressed

- Every syntactically valid download request now checks the distributed bearer-link/action bucket first, regardless of cookie state. A verified signed session then checks a second session/action bucket. Both checks fail closed through the existing generic 429/503 responses.
- Omitting, replacing, minting, collecting, or replaying signed session cookies cannot escape the aggregate bearer-link limit. The secondary bucket retains useful per-browser isolation without becoming the only enforcement boundary.
- List and grant actions remain independently domain-separated, and only nested SHA-256 identifiers reach the rate-limit database RPC; raw bearer tokens, IP addresses, and user agents are never persisted.
- `DIGITAL_DOWNLOAD_SESSION_SECRET` now uses `z.string().trim().min(32)`. Whitespace padding cannot satisfy the minimum, while legitimate surrounding whitespace is normalized consistently before runtime HMAC use.

### RED / GREEN evidence

- RED: two omitted-cookie requests minted distinct valid cookies; replaying both received independent session buckets and bypassed the aggregate test threshold. A whitespace-padded five-character secret also passed schema validation.
- GREEN: the mint/replay test exhausts one bearer bucket and both replay attempts stop at that first check with 429; the padded short secret is rejected and a valid padded secret is returned trimmed.
- Full web suite: 244 files, 928 tests passed.
- Lint, typecheck, production build, and `git diff --check`: passed.

The full suite and build retain the same pre-existing warnings documented above. The local `bd` executable remains unavailable.
