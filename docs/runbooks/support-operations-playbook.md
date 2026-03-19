# Support Operations Playbook

## Daily Workflow
1. Review `/dashboard/admin/stores` for pending approvals.
2. Check review issues in the affected store workspace when a support escalation needs moderation context.
3. Review `/dashboard/admin/legal` for pending legal communication tasks.
4. Review `/dashboard/admin/audit` for unresolved investigation follow-ups.
5. Review `/dashboard/admin/marketing` when a public-site or signup-conversion issue is reported.

## Investigation Procedure
1. Identify affected entity (`store`, `review`, `legal_update`, `context_help`, etc.).
2. Filter events in Audit Explorer and gather IDs.
3. Validate related records in the relevant workspace panel.
4. Record summary + evidence links before closing the case.

## Bead/Release Coordination
Use beads commands when shipping fixes tied to support incidents:

```bash
bd ready
bd show <issue-id>
bd close <issue-id>
```

## Communication Standards
- Include exact route links in all handoffs.
- Provide a concise timeline: detection, mitigation, resolution.
- For legal/compliance requests, attach acceptance export + version metadata.

## Core route map

- Admin dashboard: `/dashboard/admin`
- Store governance: `/dashboard/admin/stores`
- Audit explorer: `/dashboard/admin/audit`
- Legal governance: `/dashboard/admin/legal`
- Marketing analytics: `/dashboard/admin/marketing`
