---
slug: support-operations-and-escalation
title: Support Operations and Escalation
summary: Handle operator issues, route incidents to the right workspace, and produce reliable handoffs with route-level context and evidence.
category: Operations
audience: Support leads, admins, and operators covering platform workflows
lastUpdated: March 2026
owner: Support Operations
reviewCadence: Monthly
reviewBy: 2026-04-15
---

## Daily Support Surfaces
Use the admin workspace as the primary operational inbox:

- `/dashboard/admin` for high-level health
- `/dashboard/admin/stores` for approvals and governance
- `/dashboard/admin/moderation` for trust queue handling
- `/dashboard/admin/legal` for legal communication and acceptance ops
- `/dashboard/admin/audit` for evidence gathering

## Escalation Expectations
Escalate immediately when an issue affects platform-wide access, payments, legal compliance, or widespread customer impact.

Escalate quickly, but not necessarily immediately, for:

- unusual moderation edge cases
- conflicting legal evidence
- production release regressions
- order or notification failures affecting multiple stores

## Handoff Standard
Every support handoff should include:

- the exact route involved
- store slug and relevant ids
- timeline of observed behavior
- audit evidence or screenshots
- next recommended action

## Accessibility Escalations

For accessibility barriers, include:

- the exact page or feature involved
- assistive technology, browser, and device context
- whether the issue blocks checkout, authentication, legal/privacy choice, or store management
- the accessibility report id from the Admin Workspace queue when available
- the current severity and status (`new`, `triaged`, `in_progress`, `resolved`, or `dismissed`)

## Related Docs

- `/docs/admin-dashboard-and-operations`
- `/docs/audit-explorer-and-evidence`
- `/docs/release-operations-and-deployments`
