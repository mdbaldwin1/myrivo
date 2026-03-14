# Shipping Delay Operations

This runbook defines the operational and UX contract for orders that cannot ship when originally expected.

## Goal

When a store realizes it will miss the promised ship timing for an order, the team should follow a single documented workflow instead of improvising over email or internal notes.

The workflow should protect:

- customer expectations
- auditability
- policy consistency
- refund readiness when delay approval is not granted

## Ownership model

- Store owner/admin/staff own first-line shipping-delay decisions for their orders.
- Platform/support is the escalation path for repeated abuse, legal uncertainty, or failures that require policy interpretation.
- Delay handling must stay attached to the order record and timeline.

## Delay states

### Order-level delay state

- `none`
- `delay_detected`
- `customer_contact_required`
- `awaiting_customer_response`
- `delay_approved`
- `delay_rejected`
- `cancel_requested`
- `refund_required`
- `resolved`

### Related fulfillment expectations

- A delay state does not replace fulfillment status.
- Fulfillment status remains the operational shipping state (`pending_fulfillment`, `packing`, `shipped`, `delivered`).
- Delay state represents customer expectation handling when the original ship promise cannot be met.

## Required operator inputs

When a merchant records a shipping delay, the workflow should require:

- reason category
- internal operational note
- original promised ship expectation if known
- revised estimated ship date or date range
- customer path decision

## Delay reason categories

Use stable categories so operations and reporting remain interpretable:

- inventory shortfall
- supplier delay
- production delay
- carrier disruption
- weather or emergency
- address or verification issue
- staffing or fulfillment capacity issue
- other

## Customer path decisions

The operator must choose one of these paths:

1. `notify_only`
- Use when the updated date still fits policy and no explicit customer approval is required.

2. `request_delay_approval`
- Use when the customer should explicitly accept the revised ship timing.

3. `offer_cancel_or_refund`
- Use when the delay is material enough that the customer should be prompted to cancel instead of waiting.

## Customer communication rules

- The delay notice should explain what changed, why the order is affected, and the revised expectation.
- The message should avoid vague language such as “processing issue” when a clearer reason category exists.
- If customer approval is required, the notice should make the next action obvious:
  - approve the new ship timing
  - request cancellation/refund
- If the customer declines or fails to respond within the configured window, the order should be routed to follow-up rather than silently remaining in limbo.

## Timeline and audit requirements

Every shipping-delay case should record:

- who marked the order delayed
- when the delay was recorded
- reason category
- revised estimated ship date/date range
- customer communication sent
- customer response or lack of response
- whether refund/cancel action was required
- final resolution

Expected timeline events:

- `shipping_delay_recorded`
- `shipping_delay_updated`
- `shipping_delay_status_updated`
- `shipping_delay_customer_approved`
- `shipping_delay_customer_cancel_requested`
- `shipping_delay_resolved`

## UX contract

The order detail workflow should support delay handling from the same place staff already manage shipping.

Expected surfaces:

- order detail panel/flyout delay section
- clear delay badge or status summary
- customer order detail response actions for approval or cancellation requests
- decision-specific follow-up state
- timeline entries that support support/audit review

## Sequencing for implementation

1. Define delay ownership, states, copy expectations, and UX contract.
2. Add merchant order-detail delay actions and revised-date capture.
3. Add customer communication and response handling.
4. Add audit trail and operator follow-up visibility.
5. Add docs, tests, and policy/help integration.
