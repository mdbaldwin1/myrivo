# Store Approval, Order Lifecycle, and Policy Governance Plan

## Goals

- Ensure stores can only go live after passing policy/compliance checks.
- Combine AI review speed with human oversight for edge/high-risk cases.
- Provide a complete order lifecycle that works now (offline fulfillment) and later (automated digital delivery + email).
- Ground AI approval decisions in explicit Terms and Privacy rules.

## 1) Store Approval Architecture (AI + human re-review)

### Data model additions

- Add to `stores`:
  - `review_status`: `draft | pending_review | ai_rejected | approved | human_rejected`
  - `review_submitted_at`
  - `approved_at`
  - `approved_by_user_id`
  - `rejected_reason_code`
  - `rejected_reason_detail`
  - `re_review_requested_at`
  - `re_review_count`
- Add `store_review_events` table:
  - immutable event log for every review decision/request
  - captures actor (`ai` or `human`) and reasoning payload
- Add `store_review_queue` table:
  - queue state for human reviewers (`open`, `in_review`, `resolved`)

### Workflow

1. Merchant submits for review.
2. AI reviewer evaluates store against policy rubric.
3. If AI approves with high confidence:
   - status -> `approved`
   - merchant can set store `active`.
4. If AI rejects or uncertain:
   - status -> `ai_rejected`
   - merchant sees structured reasons and remediation checklist.
5. Merchant can request re-review:
   - creates queue item for human review.
6. Human reviewer approves/rejects:
   - status -> `approved` or `human_rejected`.

### Re-review behavior

- Re-review request button shown when status is `ai_rejected`.
- Require merchant to submit optional remediation notes.
- Human queue prioritization:
  - first re-review requests first
  - policy severity override for urgent moderation items

### Admin portal requirements for approval

- Queue view with filters: `new`, `re-review`, `high risk`.
- Side-by-side view:
  - store content
  - AI findings
  - policy references
  - prior decisions
- Actions:
  - Approve
  - Reject with reason template
  - Request more info

## 2) Terms, Privacy, and Policy Integration

### Required docs before go-live

- Platform Terms of Service
- Platform Privacy Policy
- Merchant Policy Guidelines (acceptable products/content/behavior)

### Product integration

- Require ToS/Privacy consent at signup and store submission.
- Version and store policy-consent timestamps.
- Show policy checklist in store submission flow.

### AI moderation grounding

- Build policy knowledge source from Merchant Guidelines.
- AI output must include:
  - decision (`approve`, `reject`, `escalate`)
  - violated policy ids
  - evidence excerpts
  - confidence score
- Never allow opaque AI rejection without policy mapping.

## 3) Order Status Lifecycle (deep design)

### Current gap

- Statuses exist, but lifecycle is not strongly modeled per order type.

### Proposed unified order model

- Payment status:
  - `awaiting_payment`, `paid`, `payment_failed`, `refunded`, `partially_refunded`
- Fulfillment status:
  - `pending_fulfillment`, `processing`, `fulfilled`, `shipped`, `delivered`, `cancelled`
- Delivery type:
  - `physical`, `digital`, `service`

### Physical default flow (MVP)

1. Order created as `paid` + `pending_fulfillment`.
2. Merchant updates to `processing`.
3. Merchant updates to `shipped` (tracking fields optional MVP, required later).
4. Merchant updates to `delivered` when complete.

### Digital default flow (phase 2)

1. Payment success triggers delivery job.
2. If delivery succeeds:
   - `fulfilled` immediately.
   - delivery receipt logged.
3. If delivery fails:
   - `pending_fulfillment` + retry queue + alert.

### Configurable state machine

- Store-level fulfillment settings:
  - enabled statuses
  - allowed transitions
  - required fields by transition
- Enforce transition validation in API.

## 4) Refunds/Returns/Disputes

### Merchant capabilities

- Full and partial refunds from order detail.
- Refund reason required (customer request, damaged item, fraud, duplicate, etc).
- Return request intake status:
  - `requested`, `approved`, `rejected`, `received`, `refunded`.

### Platform capabilities

- Admin override/refund for escalations.
- Dispute dashboard from Stripe events.
- SLA + escalation policy for unresolved customer issues.

## 5) Messaging Between Buyer and Seller

### MVP

- Order-thread messaging stored per order.
- Merchant replies in dashboard.
- Customer access via signed order link (no full customer account required for MVP).

### Later

- Email relay + in-app inbox.
- Attachments and templated responses.
- Moderation/abuse controls.

## 6) Implementation sequence

1. Legal docs + policy versioning + consent capture.
2. Review data model + AI review endpoint + merchant submission UI.
3. Human re-review queue in admin portal.
4. Order lifecycle model expansion and transition guards.
5. Refund/dispute workflows.
6. Messaging MVP.
7. Digital delivery automation and email engine.

## 7) Launch gates for this initiative

- No store can go `active` unless `review_status=approved`.
- Every rejection includes policy reason codes.
- Re-review path available in-app for `ai_rejected`.
- Fulfillment transitions validated server-side.
- Refund actions audited with actor + reason.
