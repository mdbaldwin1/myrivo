# Admin Incident Escalation Runbook

## Purpose
Define escalation behavior for platform incidents affecting governance, moderation, legal controls, or account access.

## Incident Severity
- **SEV-1**: broad platform control failure, legal/compliance risk, data integrity risk
- **SEV-2**: admin workflow degradation with active customer/store impact
- **SEV-3**: localized or low-risk operational issue

## Immediate Response
1. Open `/dashboard/admin` and collect current platform state.
2. Open `/dashboard/admin/audit` and filter relevant entity/action events.
3. Capture top-level incident summary and current blast radius.

## Technical Checks
Run these commands in the web workspace:

```bash
npm run -w @myrivo/web lint
npm run -w @myrivo/web typecheck
npm run -w @myrivo/web test
```

If the incident is release-related, verify latest CI run on the active PR and deployment state.

## Escalation Path
1. Support lead triages and opens incident channel.
2. Platform admin confirms scope and initial mitigation.
3. Product/compliance owner approves customer-facing communication for legal/policy incidents.

## Evidence Requirements
- Route links used (`/dashboard/admin/*` pages)
- Audit event IDs and timestamps
- Notification delivery evidence when communication is involved
- Remediation timeline and owner
