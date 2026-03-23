# Refunds and Disputes Operations

This runbook defines the operational contract for refunds and disputes before the full workflow is wired into the dashboard.

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
- `needs_response`
- `under_review`
- `won`
- `lost`

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

## Sequencing for implementation

1. Define the contract and shared statuses.
2. Add merchant refund actions in order detail.
3. Wire Stripe refund execution and dispute visibility.
4. Add customer messaging and policy-aware copy.
5. Add reporting, runbooks, and regression coverage.
