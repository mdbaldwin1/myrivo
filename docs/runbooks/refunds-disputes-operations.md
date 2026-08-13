# Refunds and Disputes Operations

This runbook defines the operational and digital-access contract for refunds and disputes.

## Ownership model

- Store owner/staff own normal refund decisions for their orders.
- The platform/admin side is the escalation path for disputes, policy abuse, or payment-provider issues that the store cannot resolve alone.
- Refunds and disputes should always stay attached to the order record and audit trail.

## Intended status model

### Financial status

- `pending`
- `paid`
- `failed`
- `cancelled`
- `partially_refunded`
- `refunded`

### Refund record status

- `requested`
- `processing`
- `succeeded`
- `failed`
- `cancelled`

### Dispute status

- `warning_needs_response`
- `warning_under_review`
- `warning_closed`
- `needs_response`
- `under_review`
- `won`
- `lost`
- `prevented`

## Digital access policy

The database is authoritative for financial state and digital access. A service-role-only transition RPC records the refund or dispute, changes entitlements, revokes tokens when required, and writes the financial audit event in one transaction.

- Cumulative successful refunds below the order total preserve access.
- A cumulative successful full refund revokes every entitlement with `full_refund` and revokes every active access token.
- `warning_needs_response`, `warning_under_review`, `needs_response`, and `under_review` suspend entitlements with the source dispute ID.
- `warning_closed`, `won`, and `prevented` restore only entitlements suspended by that same dispute. They never restore full-refund or lost-dispute revocations.
- `lost` revokes entitlements with the source dispute ID and revokes active tokens. This is terminal, including if a later provider event reports a win.
- Precedence is full refund, then any lost dispute, then any open dispute, then active access.

Webhook event IDs and provider-created timestamps are passed to the transition RPC. Exact event IDs are idempotent. Ordering uses the provider-created timestamp followed by the Stripe event ID in bytewise lexical order, so equal-time delivery races converge deterministically. An incoming loss still takes precedence over a current resolved/open state; once loss is recorded, later resolved/open states cannot replace it, and competing loss events advance only to the greatest source tuple. If the RPC fails, the webhook ledger is marked failed and Stripe receives a retryable error; operators must not mark that webhook processed manually.

Merchant refund execution first claims the refund under an order/refund row lock. Only the winning request calls Stripe, using `refund-request:{refund UUID}` as the provider idempotency key. Concurrent callers receive the current processing record. If Stripe accepts the refund but synchronization fails, the record stays processing for webhook replay.

Financial customer mail is not sent inline. Material refund/dispute changes enqueue an audited row in the durable notification queue within the same database transaction. The existing leased worker retries provider failures with one notification-scoped provider idempotency key and records each safe attempt. Superseded pending financial notices fail closed instead of describing an obsolete state.

The internal processor always requires `DIGITAL_DELIVERY_PROCESS_SECRET` for request authentication. `DIGITAL_DELIVERY_TOKEN_SECRET` is required only for purchase, merchant-resend, and customer-recovery work that derives an access bearer. If token derivation is unavailable, the worker reports `digital_delivery_token_unconfigured`, skips delivery jobs and bearer-dependent notification rows without leasing or incrementing them, and continues draining refund/dispute notifications.

## Reconciliation

Use `listDigitalAccessReconciliationIssues()` from `apps/web/lib/digital-products/access-state.ts` in a service-role operations job. The underlying `find_digital_access_reconciliation_issues(limit)` RPC returns only issue type, order/store IDs, and aggregate entitlement/token counts. It intentionally excludes customer data, filenames, storage paths, bearer tokens, and token hashes.

The query detects:

- paid digital orders with no durable delivery job or no entitlements;
- fully refunded orders whose entitlements or active tokens do not reflect revocation;
- open disputes whose entitlements are not suspended by a currently open source dispute;
- lost disputes whose entitlements or active tokens do not reflect terminal revocation.

Treat results as repair candidates, not instructions for blind mutation. Confirm the Stripe refund/dispute state, replay the original provider event through the normal webhook path where possible, and rerun reconciliation. Escalate persistent mismatches with the order ID, store ID, issue type, and counts only.

## Merchant UX contract

Refunds should be initiated from the order detail flyout.

Required inputs:

- refund amount
- refund reason
- customer communication decision

Expected timeline/audit events:

- `refund_requested`
- `refund_processing`
- `refund_succeeded`
- `refund_failed`
- `dispute_opened`
- `dispute_updated`
- `dispute_closed`

## Customer communication rules

- Full refund: notify customer when the refund is submitted and again if it fails.
- Partial refund: notify customer with amount, reason summary, and support contact.
- Dispute opened: notify only when the payment provider/customer outcome materially affects the order or when platform policy requires notice.

## Reporting surface

The Billing report should be the fast scan surface for finance/support work:

- refunded total
- refunds awaiting processing
- active disputes
- disputes needing response

Operators should use the report to spot workload and risk, then jump into the order detail flyout to take the actual refund or dispute action.

## Refund reasons

Use stable reasons so reporting and support can interpret the action consistently:

- customer request
- duplicate charge
- fraud suspected
- damaged item
- inventory unavailable
- shipping failure
- service issue
- other

## Failure handling

- Never apply entitlement or token corrections through application-side best-effort updates.
- Never suppress transition RPC failures. A failed transaction leaves the financial row, entitlement state, token state, idempotency row, and audit row unchanged.
- Never reassign or activate a legacy/manual `dispute_open` suspension whose source dispute ID is null. It requires explicit operator repair.
- A Stripe refund created successfully but not yet synchronized remains `processing`; its webhook is the authoritative retry path. Do not rewrite it to `failed`, because that would misrepresent provider state.
- Preserve the original provider event ID and timestamp in incident notes so ordering decisions can be verified without including payloads that may contain customer data.
