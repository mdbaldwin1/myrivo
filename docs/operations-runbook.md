# Operations Runbook

## Standard release flow

1. Merge approved feature PRs into `develop`.
2. Run local validation:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
   - `npm run e2e --workspace=@myrivo/web`
3. Push latest migrations to target database:
   - `supabase db push --linked`
4. Verify migration alignment:
   - `supabase migration list --linked`
5. Run platform rollout integrity verification:
   - `npm run verify:platform-rollout`
   - Optional relaxed mode for diagnostics: `node scripts/verify-platform-rollout.mjs --env-file=.env.local --no-strict`
6. Open release PR `develop -> main` and confirm required checks pass.
7. After merge, monitor production health metrics and auth/order activity.

## Platform rollout integrity checks

`scripts/verify-platform-rollout.mjs` validates:
- Required platform-expansion migrations are present in `supabase_migrations.schema_migrations`.
- Critical schema surface exists (roles, pickup, customer, billing, domain hosting columns).
- Each store owner has a corresponding active owner membership row.
- Billing profile coverage for each store (hard fail in strict mode).
- Pending/failed domains retain verification tokens.

If verification fails:
1. Resolve failed checks directly in DB/application migrations.
2. Re-run `supabase db push --linked` if migrations were added.
3. Re-run `npm run verify:platform-rollout` until all checks pass.

## Smoke test checklist

1. Login with merchant account.
2. Load dashboard overview, orders, insights, settings.
3. Create product and activate listing.
4. Apply promo code and run storefront checkout.
5. Confirm order appears in dashboard and fulfillment update works.
6. Export CSV and confirm downloadable output.
7. Validate shipping webhook endpoint with header-based auth (`x-shipping-webhook-secret`) and signature headers when enabled (`x-shipping-timestamp`, `x-shipping-signature`).

## Rollback model

- Application rollback: redeploy previous known-good commit.
- Data rollback: apply targeted SQL rollback script for problematic migration.
- Emergency kill switches:
  - Set all promotions `is_active=false`.
  - Set store `status='suspended'` if storefront must be paused.
