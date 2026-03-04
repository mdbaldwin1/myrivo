# Platform Launch Roadmap

This roadmap covers the remaining work for production launch and post-launch hardening.

## Current answers to open questions

1. Admin portal exists?
- Not yet. Current dashboard is merchant-facing only.

2. Should stores require approval before going live?
- Yes. Use a hybrid model: AI pre-screen + human override for high-risk/flagged stores.

3. Refunds/returns handling complete?
- Not complete. Promo/order data is present, but operational refund/dispute tooling and policy ownership are not fully implemented.

4. Seller/customer messaging after purchase?
- Not implemented yet.

5. Fulfillment flow and digital delivery automation?
- Partial only: fulfillment statuses exist. Configurable workflow states, automated email delivery, and digital fulfillment rules are not complete.

## Phase 1: Launch-critical (P0)

### A) Admin portal and operations controls
- Build admin-only area with role-gated access.
- Add platform-wide views: stores, domains, subscriptions, orders, payouts, incidents.
- Add admin actions: suspend/reactivate store, force domain re-verify, retry webhook finalization, inspect audit trail.
- Add immutable admin audit log entries for all elevated actions.

### B) Store go-live approval workflow
- Add `stores.review_status`: `draft`, `pending_review`, `approved`, `rejected`.
- Make public activation contingent on `approved` status.
- Add submission flow: merchant submits store for review.
- AI pre-screen service scores store risk:
  - prohibited products/content
  - policy completeness (shipping/returns/contact)
  - trust signals (domain, support email, content quality)
- Route medium/high risk to manual review queue.
- Add reviewer dashboard + decision history.

### C) Refunds, cancellations, disputes baseline
- Add merchant-side refund actions from order detail.
- Implement Stripe refund API integration with reason capture.
- Sync refund events into order timeline and update order financial state.
- Define responsibility matrix:
  - merchant-initiated refunds
  - platform intervention/escalation thresholds
- Add dispute visibility (chargeback events) and escalation runbook.

## Phase 2: Commerce operations (P1)

### A) Messaging and post-purchase communication
- Add order conversation thread model (merchant <-> customer).
- Support email relay initially (no in-app customer auth required for MVP).
- Add message templates: confirmation, shipping update, support follow-up.
- Add SLA/status markers for unresolved customer requests.

### B) Fulfillment workflow configurability
- Add configurable fulfillment state machine per store:
  - default: `pending_fulfillment -> processing -> fulfilled -> shipped`
- Add per-state guardrails and required fields (tracking number, carrier, fulfillment note).
- Add status automation hooks for future email triggers.

### C) Digital goods delivery architecture
- Add product type: `physical`, `digital`, `service`.
- For digital products:
  - store delivery payload (secure URL, license key, download bundle)
  - trigger delivery on payment success
  - support resend delivery and expiration controls
- Add delivery logs for compliance and support.

## Phase 3: Reliability and compliance (P1/P2)

### A) Webhook and payment robustness
- Add idempotency/event ledger for Stripe webhooks.
- Add dead-letter queue/retry tooling for failed finalizations.
- Add payout and fee reconciliation reports.

### B) Security and abuse controls
- Harden checkout abuse protections (rate limit + velocity checks + anomaly detection).
- Add stricter content/domain checks in review pipeline.
- Add account risk scoring and auto-throttle policies.

### C) Reporting and analytics
- Add merchant refund/dispute metrics.
- Add platform GMV, fee revenue, net payout, and approval funnel dashboards.

## Recommended sequencing

1. Admin portal skeleton + role gating
2. Review status model + go-live approval workflow (AI pre-screen + human queue)
3. Refund API + order timeline updates
4. Messaging MVP (email relay + order thread)
5. Fulfillment state machine config
6. Digital delivery engine
7. Reliability hardening (webhook ledger/retries/reconciliation)

## Exit criteria for launch

- All P0 items complete and tested in staging
- Stripe platform billing and Stripe Connect flows validated in live mode
- Refund/dispute and review escalation runbooks approved
- On-call alerts for checkout and webhook failures enabled
