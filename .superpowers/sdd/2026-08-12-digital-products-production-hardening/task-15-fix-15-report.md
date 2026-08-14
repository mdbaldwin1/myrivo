# Task 15 fix round 15 report

## Outcome

The sixth independent download now has a stable, shared configuration contract: HTTP `409`, machine code `download_limit_reached`, and message `Download limit reached`. The download service distinguishes only the known database exhaustion result from generic reservation failures, so unrelated internal errors retain the neutral response. The real browser journey captures and asserts the complete JSON contract before recording it in canonical evidence.

The canonical verifier rejects authentication, authorization, missing-resource, throttling, wrong-code, and wrong-message responses as grant-limit proof. Delivery recovery now additionally requires a succeeded durable job, an attempt count equal to its exact ordered chronology, and a successful persisted `merchant_resend` notification correlated by Resend message ID and timestamp.

## External status

Real Stripe, Resend, browser, and official Supabase acceptance remain unrun and unclaimed pending the documented non-production fixture, credentials, and runtime.

## Validation

- Focused route, canonical-evidence, and actual spawned-CLI tests passed (63 tests), including signed 401/403/404/429/code/message mutations.
- Repository lint and typecheck passed.
- The full Vitest suite passed.
- The production build passed with 165 routes.
