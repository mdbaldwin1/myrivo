# Task 14 Fix 2 Report: Telemetry Type and Attempt Safety

## Status

Implementation complete on `codex/digital-products` as a separate follow-up to Task 14 Fix 1.

## Findings addressed

- A forward migration replaces the database telemetry validator with a closed schema for every event type. Every required key must exist, no unknown key may exist, and every value must have its explicit JSON type before extraction or enum/range validation. The current event contracts have no optional dimensions.
- JSON null, arrays, objects, numeric strings, booleans, omitted keys, unexpected keys, non-integer attempts, negative attempts, and attempts above 10,000 are rejected. Existing invalid telemetry is removed and the table constraint is recreated so the replacement function is revalidated against stored rows.
- `delivery_job_failed` trigger telemetry now uses non-null `generation_attempt_count`, the bounded current repair budget, instead of monotonic global `attempt_count`. A legitimate transition at global attempt 10,001 therefore persists rather than rolling back on telemetry validation.
- Repeated-failure telemetry emitted by the admin health route uses `generationAttemptCount`. The response retains `attemptCount` as separate global history and `repairGeneration` as repair identity.

## Trigger source audit

- Upload and preview failure triggers emit fixed string constants from constrained lifecycle transitions.
- Delivery-job failures emit the non-null per-generation counter; normal claim/recovery entry points validate retry budgets between 1 and 100.
- Delivery-notification attempts emit non-null constrained type/status values and a counter governed by the notification entry points' validated 1–100 retry ceiling.
- Refund and dispute triggers emit non-null database-constrained status enums.
- Health SQL coalesces missing job counters to numeric zero and exposes global and generation-aware values separately. No trigger emits nullable, free-form, or legitimately unbounded data into a bounded dimension.

## TDD evidence

### RED

- The exhaustive database matrix found 2 accepted cases among 150 invalid variants: JSON null for `notificationType` and `outcome` on `delivery_email_attempted` bypassed SQL enum checks through SQL null.
- Updating a delivery job to failed with `attempt_count = 10001` and a valid generation count rolled the state transition back because the trigger emitted global attempt 10,001.
- The health route emitted global attempt 10,001 for repeated-failure telemetry instead of generation attempt 3.

### GREEN

- The direct PostgreSQL matrix accepts all 12 valid event contracts and rejects all 150 invalid variants through both the validator and the table constraint.
- The PostgreSQL regression persists a failed job at global attempt 10,001 and records numeric `attemptNumber = 2` from the current repair generation.
- The health-route regression records generation attempt 3 while retaining global attempt 10,001 in the response model.
- Focused migration tests pass all 122 cases; focused operations-route tests pass all 5 cases.

## Validation

- `npm run lint` — passed with zero lint warnings/errors; consistency checks passed.
- `npm run typecheck` — passed.
- `npm test` — 265 files and 1,082 tests passed.
- `npm run build` — passed; optimized Next.js build and TypeScript validation completed.
- `git diff --check` — passed.

## Operational notes

- Alert and event aggregation must interpret failed-job `attemptNumber` as the current repair-generation budget, not lifetime attempt history.
- Use health `attemptCount` for lifetime history and `generationAttemptCount` plus `repairGeneration` for current retry triage.
- `bd` remains unavailable in the worktree, so evidence is recorded in this report.
