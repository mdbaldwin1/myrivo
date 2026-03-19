---
slug: admin-dashboard-and-operations
title: Admin Dashboard and Operations
summary: Work queue-first in the admin dashboard, then move into Users and Stores for management tasks.
category: Operations
audience: Platform admins and support leads
lastUpdated: March 2026
owner: Platform Operations
reviewCadence: Monthly
reviewBy: 2026-04-15
---

## Operations Checklist
Start each day in `/dashboard/admin` and clear the queues that need platform attention first.

- Review the approval queue and route stores needing deeper work into `/dashboard/admin/stores`
- Review accessibility reports and route follow-up owners
- Verify no critical moderation or legal backlog in the dedicated workspaces

## Workspace Routes
Use the admin workspace pages intentionally instead of treating the dashboard as the only control surface.

- `/dashboard/admin` for platform queues and triage
- `/dashboard/admin/users` for user directory and global role management
- `/dashboard/admin/stores` for the full store directory, platform access, and governance actions
- `/dashboard/admin/revenue` for GMV, platform fee revenue, refunds, disputes, and payout flow
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
- `/docs/audit-explorer-and-evidence`
- `/docs/legal-governance-and-consent-ops`
- `/docs/release-operations-and-deployments`
- `/docs/support-operations-and-escalation`
