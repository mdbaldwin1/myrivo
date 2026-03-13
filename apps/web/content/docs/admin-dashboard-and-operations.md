---
slug: admin-dashboard-and-operations
title: Admin Dashboard and Operations
summary: Operate the platform control plane, monitor health, and execute daily admin checks.
category: Operations
audience: Platform admins and support leads
lastUpdated: March 2026
owner: Platform Operations
reviewCadence: Monthly
reviewBy: 2026-04-15
---

## Operations Checklist
Start each day in `/dashboard/admin` and confirm platform snapshot health.

- Review store status counts and pending review queue
- Confirm notification health and failed delivery counts
- Verify no critical moderation backlog

## Workspace Routes
Use the admin workspace pages intentionally instead of treating the dashboard as the only control surface.

- `/dashboard/admin` for overall platform status
- `/dashboard/admin/stores` for store approvals and governance actions
- `/dashboard/admin/moderation` for review and media moderation
- `/dashboard/admin/audit` for evidence gathering and sequence reconstruction
- `/dashboard/admin/legal` for legal document publishing and acceptance operations
- `/dashboard/admin/marketing` for public-site funnel and experiment reads

## Priority Routing
Treat incidents in this order: platform access/control issues, legal/compliance issues, then content moderation and store approvals.

Escalate any production-wide incident immediately to the on-call owner.

## End-of-Day Closeout
Document unresolved actions and route handoff notes through your support channel with route links and evidence IDs.

## Related Docs

- `/docs/store-governance-and-approvals`
- `/docs/moderation-workflows-and-escalation`
- `/docs/audit-explorer-and-evidence`
- `/docs/legal-governance-and-consent-ops`
- `/docs/release-operations-and-deployments`
- `/docs/support-operations-and-escalation`
