# Legal Update Communications Runbook

## Purpose
Provide a repeatable process to notify affected users when a required legal document version is published.

## Scope
- In-app notification delivery
- Email notification delivery
- Audit evidence for what was sent and when
- Escalation path for disputes/evidence requests

## Preconditions
1. Publish a legal version in Admin Workspace: `/dashboard/admin/legal`.
2. Confirm the published version has the expected `version_label` and `effective_at`.
3. Confirm platform sender/reply-to settings are configured.

## Send Update Notices
1. Open `/dashboard/admin/legal`.
2. In `Recent Versions`, find the published version.
3. Click `Send Update Notice`.
4. Verify success toast with sent/skipped counts.

## Verification Checklist
1. Check Admin Audit Explorer for `legal_update.announce` event.
2. Confirm `notifications` rows with `event_type = legal.update.required`.
3. Confirm `notification_delivery_attempts` rows for email channel.
4. Confirm users are redirected through `/legal/consent` gate when required.

## SQL Queries
```sql
-- Recent legal update sends
select id, created_at, actor_user_id, metadata
from audit_events
where entity = 'legal_update' and action = 'announce'
order by created_at desc
limit 50;

-- Notification delivery health for legal updates
select n.created_at, n.recipient_user_id, n.status, nda.status as delivery_status, nda.error
from notifications n
left join notification_delivery_attempts nda on nda.notification_id = n.id
where n.event_type = 'legal.update.required'
order by n.created_at desc
limit 200;
```

## Incident / Escalation
1. If email failures spike, review `notification_delivery_attempts.error` and sender domain configuration.
2. If wrong audience was targeted, log incident in `audit_events` and issue corrective communication.
3. For legal disputes/evidence requests:
   - Export acceptance records from `/dashboard/admin/legal` (CSV)
   - Include version label, acceptance timestamp, surface, and recipient evidence
   - Route to legal/compliance owner for final response

## Ownership
- Primary: Platform Admin
- Secondary: Support Lead
- Escalation: Product/Compliance owner
