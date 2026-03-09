# Support Operations Playbook

## Daily Workflow
1. Review `/dashboard/admin/stores` for pending approvals.
2. Review `/dashboard/admin/moderation` queue and prioritize high-severity items.
3. Review `/dashboard/admin/legal` for pending legal communication tasks.
4. Review `/dashboard/admin/audit` for unresolved investigation follow-ups.

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
