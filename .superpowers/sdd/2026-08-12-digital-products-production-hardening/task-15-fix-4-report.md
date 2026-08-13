# Task 15 Fix Round 4

- Added migration `20260813023000` implementing the missing service-role-only non-production acceptance RPC, target/run/store/project binding, typed actions, idempotency audit, and database-side production/tamper rejection.
- Added native PostgreSQL tests for privileges, environment/project mismatch, cross-run/store denial, invalid transitions, and idempotency.
- Hardened the route against self-hosted `NODE_ENV=production` and required exact application origin and project allowlisting.
- Split the CI-held evidence HMAC key from the control bearer and reject reuse.
- Replaced spoofed image bytes with a valid PNG and encoded Stripe-hosted test-card checkout for digital-only and mixed carts, waiting for the actual return path instead of navigating to a seeded return URL.
- Strengthened final evidence checks to require the named mutation sequence and linked non-live observations.

External Stripe/Resend browser acceptance was not run or claimed because credentials and a deployed fixture are absent. Official Supabase verification was attempted again and remains blocked because the Docker daemon is unavailable. These remain release blockers.

Validation: lint and typecheck passed; 269 test files / 1,103 tests passed, including 133 native migration tests and 29 concurrency tests; the production build passed with 165 routes/pages.
