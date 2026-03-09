# Environment Variable Matrix

## Required for local development

- `NEXT_PUBLIC_APP_URL` (example: `http://localhost:3000`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_STUB_MODE` (`true` while local testing)
- `MYRIVO_SINGLE_STORE_SLUG` (fallback/default storefront slug, example: `at-home-apothecary`)
- `OWNER_ACCESS_EMAILS` (comma-separated dashboard-access emails)
- `MYRIVO_ALLOW_PUBLIC_SIGNUP` (`false` for invite-only owner access)
- `SHIPPING_PROVIDER` (`none` or `easypost`)
- `EASYPOST_API_KEY` (required when `SHIPPING_PROVIDER=easypost`)
- `SHIPPING_WEBHOOK_SECRET` (required for shipping webhook auth)
- `RESEND_API_KEY` (required to send order/customer emails)
- `MYRIVO_EMAIL_FROM` (verified sender, e.g. `Store Name <orders@yourdomain.com>`)
- `MYRIVO_ORDER_ALERT_EMAILS` (optional comma-separated owner notification emails; falls back to `OWNER_ACCESS_EMAILS`)

## Required for Stripe live mode (hold until cutover)

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Required for CI / production deploy

- `VERCEL_TOKEN`
- Vercel project/team scope values used by workflow

## Notes

- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- For production, set `STRIPE_STUB_MODE=false` only during final go-live cutover.
- Authenticated dashboard/API tenant selection is membership-driven; `MYRIVO_SINGLE_STORE_SLUG` is fallback-only.
- Validate envs with smoke tests after each deployment.
