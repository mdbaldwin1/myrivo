# Task 15 Fix Round 3

## Completed

- Renamed the two colliding security migrations to unique later versions `20260813021000` and `20260813022000` and added a repository-wide uniqueness contract.
- Added native PostgreSQL behavioral coverage for secure-session privileges and release approval exact-match, mismatch, revocation, expiry, review-time, maximum-window, and application-role privilege boundaries.
- Added a versioned, separately authenticated, strict-schema acceptance-control route/service that is unavailable in production and independently queries authoritative order, delivery-job, and grant state rather than accepting caller-supplied expected state.
- Reworked browser acceptance so merchant upload/publish/replacement/resend and buyer cart/checkout/access/download/recovery use rendered UI. Guarded controls are limited to deterministic reset/provider event or failure injection and independent observation.
- Replaced static evidence input with current-run HMAC-signed evidence bound to release SHA, environment, origin, run ID, actions, observations, and timestamps. CI now supplies the approved non-production host and a fresh evidence output path.
- Added a configurable 15-second download-initiation watchdog, concurrent-attempt lock, retryable live error, and regression coverage.

## External blockers

- The Supabase CLI is installed, but the official local fresh/upgrade workflow could not start because the Docker daemon is unavailable. `supabase status` failed with `Cannot connect to the Docker daemon`. Native PostgreSQL tests validate behavior, but official Supabase fresh and upgraded project verification remains a release blocker.
- No real Stripe/Resend acceptance is claimed. Provider credentials, deployed non-production fixture/control configuration, and the provider-supported dispute injection path remain required before rollout.

## Validation

- Focused acceptance-control, migration-version, download UX, and release-approval tests passed.
- Full test suite passed: 268 files / 1,097 tests, including 130 native migration tests and 29 concurrency tests.
- Typecheck, lint, and production build passed; 165 routes/pages generated.
- Playwright compiled and listed 13 digital acceptance/accessibility tests.
