# Digital Products Rollout and Operations

## Safety model

Digital products require both `billing_plans.feature_flags_json.digitalProducts = true` and `store_feature_flags.digital_products = true`. Missing rows, missing keys, malformed values, inactive plans, and read errors resolve to disabled. The database enforces the same effective policy; route checks exist for fast, clear feedback.

Disabling a store stops new or pending digital catalog, asset, preview, publish, storefront, cart, manifest, checkout, and paid-order settlement work. The database locks and rechecks the pending checkout before the first paid-order row is created, including when Stripe reports payment after disablement. It does not disable completed paid-order delivery, access recovery, resend, download, refund, dispute, or reconciliation. Operators may still archive an existing digital product while disabled.

If payment completed before a pending digital checkout was blocked, the checkout is marked failed with refund-support guidance. Do not bypass the rollout guard or create an order manually; arrange the appropriate customer refund through the financial workflow.

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

The Digital Product Operations page is admin-only and reports identifiers plus bounded state, never customer email, filenames, object paths, token hashes, bearer tokens, or signed URLs. Delivery health distinguishes the monotonic global attempt number from the current repair generation and its fresh attempt budget.

Investigate these issue codes:

- `paid_delivery_pending_over_5m`: a paid digital order is older than five minutes and delivery is absent or incomplete.
- `repeated_delivery_failures`: a delivery job has failed at least three attempts.
- `access_state_mismatch`: entitlement/token state differs from the authoritative refund or dispute state.

Privacy-safe events cover upload and preview failures, manifest failures, aged/failed jobs, email attempts, link regeneration, download signing failures, grant exhaustion, reconciliation mismatches, and refund/dispute transitions. Each event has its own closed dimension schema: fixed keys, explicitly typed enum strings, and bounded integers. Missing keys, JSON null, wrong JSON types, free-form names, labels, reasons, paths, URLs, emails, and oversized values are rejected in both the application and database. Failed-job event `attemptNumber` is the bounded current-generation attempt count; use the separate health `attemptCount` field only for monotonic global history.

## Repair actions

- Requeue only retryable pending/failed delivery work. A succeeded job is not reset. Explicit requeue increments the repair generation and resets only that generation's attempt budget; the immutable attempt ledger continues with the next global attempt number.
- Resend only after successful initial delivery. This rotates the access link without resetting download-grant usage.
- Reconcile re-applies financial access policy and restores missing delivery work for a paid locked manifest.

All controls require a platform admin, trusted origin, actor identity, and idempotency key. Database functions are service-role-only, serialize duplicate request keys before mutation, and write one set of audit evidence for the winning request. If an action returns a conflict, inspect the order state instead of bypassing eligibility.

## Incident checks

1. Confirm effective plan and store flags independently.
2. Check the safe health issue code, job status, global attempt number, repair generation/budget count, and age.
3. Confirm the immutable purchase manifest is locked; never rebuild delivery from the mutable catalog.
4. Requeue once and observe the next durable attempt.
5. Reconcile only when an access mismatch is present.
6. Escalate repeated failures without copying raw provider errors or customer/access data into tickets.

## Acceptance evidence terminal contracts

The release gate reads the download-limit contract from the shared digital-product configuration. After exactly five issued grants, the next independent session must receive HTTP `409` with JSON code `download_limit_reached` and the customer-safe message `Download limit reached`. Authentication, authorization, missing-resource, throttling, or generic conflict responses do not prove grant exhaustion.

Delivery-retry evidence is valid only when the observed durable job is `succeeded`, its persisted attempt count exactly matches the ordered attempt ledger, the first recorded attempt failed, the final attempt succeeded, and the correlated notification is a successful `merchant_resend` sent through Resend with the exact provider message ID and timestamp in the provider evidence.
