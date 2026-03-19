# Pilot Store Readiness

Last updated: 2026-02-26

## Completed in this repo/environment

- Single-store mode implemented and wired through app/API.
- Canonical store slug configured in local env:
  - `MYRIVO_SINGLE_STORE_SLUG=sunset-mercantile`
- DB migrations applied to linked hosted Supabase project:
  - `20260226233000_single_store_fulfillment_status.sql`
  - `20260226234000_single_store_zero_platform_fee.sql`
  - `20260227001000_product_variants_catalog.sql`
- Fulfillment lifecycle now enforced:
  - `pending_fulfillment -> fulfillment_in_progress -> fulfilled`
- Guest cart persistence enabled via `localStorage`.
- Product image uploads enabled (Supabase storage).
- Product edit flow enabled in dashboard.
- `lint`, `typecheck`, and production `build` all pass.

## Current remote data status

- Store slug: `sunset-mercantile`
- Store name: `Sunset Mercantile`
- Store status: `active`
- Stripe account connected: `no` (`stripe_account_id` is null)
- Product count: `0` (active: `0`)
- Order count: `0`
- Current owner email on store:
  - `storefoundry+1772034301505-48636@example.com`

## Required before sister can run business on it

1. Assign store ownership to your sister's auth user.
2. Sign in as your sister and connect Stripe in `Dashboard > Account Settings`.
3. Add products and set them to `active`.
4. Configure branding, support email, shipping/returns text.
5. Configure shipping tracking provider + webhook:
   - `SHIPPING_PROVIDER=easypost`
   - `EASYPOST_API_KEY=...`
   - `SHIPPING_WEBHOOK_SECRET=...`
   - webhook URL: `/api/shipping/webhook?token=<SHIPPING_WEBHOOK_SECRET>`
6. Run one real checkout test in Stripe test mode, then one low-value live transaction.
7. Run one shipped-order test and verify webhook-driven `delivered` transition.

## Access control env requirements

- `OWNER_ACCESS_EMAILS` should include both your email and your sister's email.
- `MYRIVO_ALLOW_PUBLIC_SIGNUP=false` to keep dashboard access invite-only.

## Fast commands

### Re-run migrations (if needed)

```bash
supabase db push --linked
```

### Reassign owner to your sister

```bash
node scripts/assign-store-owner.mjs <owner_email> sunset-mercantile
```

### Local app run

```bash
npm run dev -w @myrivo/web
```

## Notes

- Refund flow is intentionally not implemented yet.
