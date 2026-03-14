---
slug: moderation-workflows-and-escalation
title: Moderation Workflows and Escalation
summary: Review user-generated content, apply consistent moderation actions, and escalate edge cases.
category: Operations
audience: Support and trust operators
lastUpdated: March 2026
owner: Trust & Safety
reviewCadence: Monthly
reviewBy: 2026-04-15
---

## Moderation Queue Triage
Open `/dashboard/admin/moderation` and sort pending content by age and severity.

Resolve clear-cut policy violations first, then move to ambiguous cases requiring escalation.

## Moderation SLA and Escalation
Target same-day handling for critical violations and 1-business-day handling for standard queue items.

- Immediate escalate: legal threats, doxxing, explicit abuse
- Escalate within 1 hour: repeated offender patterns
- Standard review: low-risk quality issues

## Evidence Handling
Capture review ID, action taken, rationale, and timestamps for every moderation event.

For review moderation specifically:

- use policy-based reasons, not sentiment-based reasons like `low rating`
- preserve legitimate negative feedback when it is honest and on-topic
- prefer an owner response when the issue is customer experience rather than abuse or fraud

## Related Docs

- `/docs/admin-dashboard-and-operations`
- `/docs/audit-explorer-and-evidence`
- `/docs/support-operations-and-escalation`
