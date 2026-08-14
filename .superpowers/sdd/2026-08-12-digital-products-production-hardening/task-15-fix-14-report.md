# Task 15 fix round 14 report

## Outcome

The command-line release gate no longer contains a second semantic implementation. It performs runtime and file setup, then delegates signature, freshness, binding, secret scanning, and every scenario invariant to the shared canonical verifier. Integration coverage spawns the real script with a deterministic complete artifact, proves success, then proves both signed semantic corruption and signature corruption fail.

The complete fixture now contains the actual released signing-fault grant with bounded error/timestamp and a later issued retry. Delivery retry evidence must correlate its Resend message ID and timestamp to the successful persisted notification. Adversarial coverage includes these boundaries and per-record run binding.

Customer order state now propagates an explicit financial access reason from entitlement state. Full refunds and lost disputes render accurate, separately tested buyer copy. The strict accessibility specification exercises partial refunds, delivery failure, resend failure, signing failure, grant limits, and silent timeout across mobile and desktop with live text, focus/retry behavior, activated zoomed cart/return controls, and axe checks.

## External status

Real Stripe, Resend, browser, and official Supabase acceptance remain unrun and unclaimed pending the documented non-production fixture, credentials, and runtime.

## Validation

- Repository lint and typecheck passed.
- 270 Vitest files and 1,133 tests passed.
- The production build passed with 165 routes.
- Playwright discovery compiled 19 strict digital-product acceptance tests.
