# Task 15 Independent Security Re-review — Round 7

## Verdict

**FAIL — one P1 evidence-integrity blocker remains.** Database-owned acceptance configuration, target/run/store checks, privileges, preview/production guards, and provider preflight are materially improved. The browser now calls provider-backed refund/dispute helpers rather than rejected synthetic RPCs. However, the provider results are discarded and the signed canonical evidence contains no refund, dispute, webhook, or Resend provider identity, so scenario labels can still certify unproven provider behavior.

## Finding

### P1 — Canonical signed evidence does not include or verify the provider artifacts that supposedly establish acceptance

Evidence:

- `apps/web/e2e/digital-products-fixture.ts:65-75` creates a real Stripe test refund and validates its `re_` ID/payment/status, but `apps/web/e2e/digital-products.spec.ts:94` discards the returned refund object. It is never passed into `acceptanceAction` or the evidence writer.
- `apps/web/e2e/digital-products-fixture.ts:78-86` obtains a dispute ID and event IDs from the configured helper, but `apps/web/e2e/digital-products.spec.ts:107` also discards that result.
- `getResendAccessMessage()` returns the provider message ID/content/link, but `apps/web/e2e/digital-products.spec.ts:47-49` records only a subsequent generic application observation under scenario label `resend-access`.
- The shared strict schema in `apps/web/lib/digital-products/acceptance-evidence.ts:12-25` contains the original succeeded PaymentIntent and application order/job/grant/notification/manifest rows only. It has no Stripe refund/dispute object, Stripe event/webhook receipt, or Resend provider message/delivery fields.
- `scripts/verify-digital-products-acceptance.mjs:44-63` treats scenario names as satisfying the matrix. Its provider check at lines 53-54 validates only the original PaymentIntent. It does not correlate refund/dispute helper results to provider state or a persisted webhook event, and does not bind the Resend ID/recipient/sender/delivery time to the signed artifact.

Impact:

A validly signed evidence file can claim `stripe-partial-refund`, `stripe-full-refund`, `stripe-dispute-won`, `stripe-dispute-lost`, and `resend-access` based only on caller-selected scenario labels plus resulting application state. It does not prove which provider object/event caused that state, that the real webhook endpoint received a correctly signed event, or that the matching Resend message was current and delivered. This weakens the release approval from provider acceptance to labeled state observation.

Required remediation:

Extend the canonical schema with a discriminated, scenario-specific `providerEvidence` union. Refund evidence must include Stripe `re_` object ID, PaymentIntent ID, amount/status/livemode, relevant `evt_` ID, and correlated persisted webhook receipt/processed record. Dispute evidence must include `dp_` ID, expected Stripe status/livemode, correlated `evt_` sequence, helper attestation identity, and persisted webhook/application correlation. Resend evidence must include message ID, sender, exact recipient/order, provider delivery status/timestamps, and safe-link validation result. Pass provider results into the evidence writer, sign them, and have the verifier require exact provider/application correlation for every scenario. Reject duplicate or stale scenario/provider IDs and any scenario label without its required discriminant.

## P2 observations

### P2 — Dispute helper trust is bearer-only and URL scope is not validated

`MYRIVO_STRIPE_DISPUTE_HELPER_URL` is accepted as an arbitrary URL and called with a privileged helper token. Constrain it to an explicit allowlisted HTTPS origin, reject redirects, require a versioned signed response/attestation, and bind run/release/payment IDs. This prevents configuration mistakes from exfiltrating the helper token or accepting a lookalike response.

### P2 — Provider transitions need bounded polling rather than a single eventual UI assertion

The financial tests trigger provider operations and immediately navigate/assert. A 60-second dispute UI timeout exists, but refunds use default timeouts and neither path explicitly polls for correlated webhook completion. Use bounded polling of the authoritative acceptance observation keyed by provider event/object before evaluating UI, with safe timeout diagnostics.

## Verified resolutions

- Acceptance configuration is now database-owned in `digital_acceptance_configuration`, inaccessible even to `service_role`; callers cannot choose environment/project identity through RPC arguments.
- The service-role RPC validates active database config against active, unexpired run/store target and rejects cross-run/store subjects, invalid transition pairs, unsupported financial injection, and replayed mutation keys.
- Observe requests also cross the database RPC boundary before privileged queries, preventing the route from observing arbitrary orders outside the configured target store/run.
- Preview/production route guards remain fail closed and require preview tier, acceptance build, exact origin/project, and control credential.
- Refund acceptance uses Stripe test API; dispute acceptance requires explicit helper URL/token and otherwise fails before the suite. Synthetic database financial certification is removed.
- Dynamic checkout order IDs, exact checkout composition, manifest versions, unique five-grant count, and application order/provider-PaymentIntent correlation use one strict shared schema.
- HMAC evidence key remains separate from control authentication, and run/origin/release/subject/scenario freshness checks remain enforced.
- Prior bearer/API/path, fragment retry, POST/origin, migration uniqueness, release approval/runtime binding, and service-role privilege fixes remain intact.
- Focused control/evidence/migration-version suites passed: 3 files, 9 tests. Docker/Supabase official verification and real provider execution remain external blockers, not code defects.

## Review scope

Reviewed diff `a9224c5..39eb128`, database-owned configuration and privileges, observe/mutation RPC behavior, refund/dispute preflight and browser calls, strict shared schema, evidence writer/verifier, Resend handling, native tests, and all prior security findings. No implementation file was changed.
