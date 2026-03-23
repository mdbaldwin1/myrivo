# Storefront Analytics Operations Runbook

## Retention policy

- Raw `storefront_events`: retain 180 days.
- `storefront_sessions`: retain 365 days.
- `storefront_daily_rollups`: retain indefinitely.
- Cleanup cadence: weekly.

These defaults are mirrored in code at `/Users/mbaldwin/Myrivo/myrivo/apps/web/lib/analytics/retention.ts`.

## Cleanup mechanism

The database cleanup function is:

```sql
select * from public.purge_storefront_analytics_data();
```

Optional overrides:

```sql
select * from public.purge_storefront_analytics_data(180, 365);
```

Guardrails:

- raw events cannot be purged below 30 days
- session retention cannot be shorter than raw event retention

## Recommended scheduling

Run the cleanup function weekly from your database scheduler or operations job runner.

Recommended schedule:

- once per week during low-traffic hours
- log the returned deleted row counts
- alert only if the function errors, not when it deletes zero rows

## Troubleshooting analytics gaps

1. Check `/api/analytics/collect` responses in browser network tools.
2. Confirm the storefront analytics debug mode if needed (`analyticsDebug=1`).
3. Verify recent rows exist in:
   - `storefront_sessions`
   - `storefront_events`
4. If the owner dashboard is empty but events exist, compare the selected analytics range with `occurred_at`.
5. If exports are empty, check both:
   - instrumentation coverage for the relevant event type
   - governance sanitization dropping unsafe payload fields

## Backfill expectations

- Current owner analytics pages query raw sessions/events plus attributed orders.
- Deleting raw events older than retention means historical analytics outside that window are intentionally unavailable unless a future rollup backfill job is added.
- Do not promise analytics recovery beyond the raw retention window without a dedicated backfill project.

## Support notes

- Search queries that resemble email addresses or phone numbers are redacted by design.
- Referrer URLs are stored without query strings.
- Marketing entry paths preserve only `utm_*` parameters.
- If a merchant asks why a specific sensitive query is missing, treat that as expected privacy behavior, not data loss.
