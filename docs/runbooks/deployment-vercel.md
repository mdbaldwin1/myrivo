# Vercel Deployment Runbook

## Required accounts

- Vercel project (production + preview)
- Supabase project
- Stripe account (Billing + Connect enabled)

## Environment variables (Vercel)

Minimum required app env vars:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Add these when the corresponding production features are enabled:

- Payments
  - `STRIPE_SECRET_KEY`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- Email delivery
  - `MYRIVO_EMAIL_PROVIDER`
  - `RESEND_API_KEY`
  - `MYRIVO_EMAIL_FROM`
  - `MYRIVO_EMAIL_PLATFORM_FROM`
  - `MYRIVO_EMAIL_REPLY_TO`
- Onboarding AI
  - `MYRIVO_ONBOARDING_AI_PROVIDER`
  - `MYRIVO_ONBOARDING_AI_MODEL`
  - `OPENAI_API_KEY`
- Shipping
  - `SHIPPING_WEBHOOK_SIGNING_SECRET`
  - `SHIPPING_WEBHOOK_REQUIRE_SIGNATURE`
  - `SHIPPING_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS`
- Reviews / analytics / scheduled jobs
  - `REVIEWS_ROLLOUT_STORE_SLUGS`
  - `STOREFRONT_REVIEW_SCHEMA_MIN_COUNT`
  - `STOREFRONT_REVIEW_SCHEMA_MAX_RECENT`
  - `NOTIFICATIONS_CRON_SECRET`

Optional runtime defaults / admin integrations:

- `MYRIVO_SINGLE_STORE_SLUG`
- `MYRIVO_ORDER_ALERT_EMAILS`
- `VERCEL_API_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_TEAM_ID`

## GitHub Actions secrets (for automated deploy workflow)

- `VERCEL_TOKEN`

CI also expects these secrets when you want full validation instead of partial/no-op checks:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `E2E_OWNER_EMAIL`
- `E2E_OWNER_PASSWORD`

Deploy behavior:
- Push to `main` triggers production deployment.
- No automatic deployments run for non-`main` branches.
- Workflow targets Vercel scope `michael-baldwins-projects`.
- Workflow runs Vercel CLI with `--cwd apps/web` for monorepo-safe Next.js builds/deploys.

## Release verification commands

Run these before approving release promotion:

```bash
cd apps/web
npm run lint
npm run typecheck
npm test
npm run build
```

If the change includes database migrations:

```bash
npx supabase migration list
npx supabase db push
```

## DNS and domains

- Primary production domain should point directly to this single-store app.
- Storefront lives at root (`/`), owner dashboard is routed under `/dashboard`.

## Webhook routing

- Stripe endpoint: `/api/stripe/webhooks`
- Configure one webhook endpoint per environment.
- If shipping webhooks are enabled, make sure each store's shipping integration points to the correct environment-specific callback and matching signing secret.

## Post-deploy route check

Validate the most important production routes after deploy:

- `/`
- `/pricing`
- `/signup`
- `/dashboard`
- `/dashboard/admin`
- `/s/:storeSlug`
- `/checkout`
