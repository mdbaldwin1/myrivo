# Reviews Incident Triage Runbook

## Scope
Use this runbook when review submission, moderation, or media upload flows show degraded health.

## Detection Surfaces
1. `/dashboard/admin` -> Reviews Pipeline Health panel
2. `/dashboard/admin/moderation` queue size and stuck items
3. `/dashboard/admin/audit` for `review_pipeline.upload_error` events

## Immediate Checks
1. Validate current counters in `/api/platform/reviews/health`.
2. Inspect latest upload errors from `audit_events`.
3. Check pending queue age and identify oldest stuck reviews.

## SQL Queries
```sql
-- Pending queue latency
select id, store_id, created_at, now() - created_at as age
from reviews
where status = 'pending'
order by created_at asc
limit 100;

-- Upload failures captured by telemetry
select id, store_id, created_at, metadata
from audit_events
where entity = 'review_pipeline' and action = 'upload_error'
order by created_at desc
limit 100;
```

## Mitigation
1. If upload failures spike, verify storage bucket access and signed upload URL flow.
2. If moderation queue is stale, route additional support/admin reviewers.
3. If low-star volume spikes, prioritize owner response workflows and monitor for abuse patterns.

## Escalation
- Escalate to platform owner when pending oldest age exceeds agreed SLA.
- Escalate immediately for persistent upload failures affecting multiple stores.
