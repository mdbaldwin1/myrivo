# Digital Products Rollout and Operations

## Safety model

Digital products require both `billing_plans.feature_flags_json.digitalProducts = true` and `store_feature_flags.digital_products = true`. Missing rows, missing keys, malformed values, inactive plans, and read errors resolve to disabled. The database enforces the same effective policy; route checks exist for fast, clear feedback.

Disabling a store stops new or pending digital catalog, asset, preview, publish, storefront, cart, manifest, and checkout work. It does not disable completed paid-order delivery, access recovery, resend, download, refund, dispute, or reconciliation. Operators may still archive an existing digital product while disabled.

Physical catalog and checkout behavior is independent of this flag.

## Rollout sequence

1. Deploy the migration and application with every plan explicitly ineligible and every store effectively disabled.
2. Confirm `/dashboard/admin/digital-products` loads with no unsafe fields and the migration health RPC is service-role-only.
3. Set `digitalProducts` to boolean `true` on one eligible internal billing plan.
4. Enable one internal store through the admin operation API using a unique `Idempotency-Key`.
5. Validate digital draft creation, upload completion, preview, publish, storefront visibility, digital-only checkout, mixed checkout, confirmation, delivery, access recovery, refund, and dispute behavior.
6. Review alerts and safe event counts for at least one full delivery retry window before adding stores.
7. Expand in small store cohorts. Never bulk-enable stores by changing a plan alone.

## Disable and rollback

Use the rollout operation with `enabled: false`. Do not delete manifests, jobs, entitlements, access tokens, or financial records. Existing paid orders must continue through their normal durable workflows.

For a full application rollback, first disable every enabled store, then deploy the prior application. Leave the rollout tables and migration in place. Database additions are backward compatible and preserve historical order access.

## Health and alerts

The Digital Product Operations page is admin-only and reports identifiers plus bounded state, never customer email, filenames, object paths, token hashes, bearer tokens, or signed URLs.

Investigate these issue codes:

- `paid_delivery_pending_over_5m`: a paid digital order is older than five minutes and delivery is absent or incomplete.
- `repeated_delivery_failures`: a delivery job has failed at least three attempts.
- `access_state_mismatch`: entitlement/token state differs from the authoritative refund or dispute state.

Privacy-safe events cover upload and preview failures, manifest failures, aged/failed jobs, email attempts, link regeneration, download signing failures, grant exhaustion, reconciliation mismatches, and refund/dispute transitions. Dimensions are allowlisted and bounded.

## Repair actions

- Requeue only retryable pending/failed delivery work. A succeeded job is not reset.
- Resend only after successful initial delivery. This rotates the access link without resetting download-grant usage.
- Reconcile re-applies financial access policy and restores missing delivery work for a paid locked manifest.

All controls require a platform admin, trusted origin, actor identity, and idempotency key. Database functions are service-role-only and write audit evidence. If an action returns a conflict, inspect the order state instead of bypassing eligibility.

## Incident checks

1. Confirm effective plan and store flags independently.
2. Check the safe health issue code, job status, attempt count, and age.
3. Confirm the immutable purchase manifest is locked; never rebuild delivery from the mutable catalog.
4. Requeue once and observe the next durable attempt.
5. Reconcile only when an access mismatch is present.
6. Escalate repeated failures without copying raw provider errors or customer/access data into tickets.
