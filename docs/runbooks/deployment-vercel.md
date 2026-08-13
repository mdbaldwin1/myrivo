# Vercel Deployment Runbook

## Required accounts

- Vercel project (production + preview)
- Supabase project
- Stripe account (Billing + Connect enabled)

## Environment variables (Vercel)

Minimum required app env vars:

- `NEXT_PUBLIC_APP_URL`
- `MYRIVO_PUBLIC_APP_URL`
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
- Digital-product delivery worker
  - `DIGITAL_DELIVERY_PROCESS_SECRET`
  - `DIGITAL_DELIVERY_TOKEN_SECRET`
  - `DIGITAL_DOWNLOAD_SESSION_SECRET`
  - `DIGITAL_RECOVERY_TRUSTED_IP_HEADER` (non-Vercel deployments only)
  - Configure the scheduler to `POST /api/internal/digital-delivery/process` with `Authorization: Bearer <DIGITAL_DELIVERY_PROCESS_SECRET>` only after the digital-product release gate is enabled.
  - The processor drains purchase-finalization and delivery-notification jobs, including customer recovery. Monitor `digital_delivery_jobs`, `digital_delivery_notifications`, their attempt tables, and `digital_access_recovery_failures` for terminal or transactional failures; these records contain bounded safe errors and never bearer links or storage URLs.
  - Keep `DIGITAL_DELIVERY_TOKEN_SECRET` stable. Merchant resend and verified customer recovery intentionally rotate only their own active token and queue a new 48-hour message; neither operation resets entitlement grant counters.
  - Keep `DIGITAL_DOWNLOAD_SESSION_SECRET` stable and separate from delivery-token credentials. It signs opaque download-session cookies used for grace reuse and guest-recovery throttling; rotation invalidates only those browser sessions.
  - Guest recovery aggregates distributed limits by a keyed client-IP digest, signed session, and keyed order/email pair. On Vercel, the application accepts only `X-Vercel-Forwarded-For`, which Vercel supplies independently of proxy-overwritable forwarding headers. Outside Vercel, configure `DIGITAL_RECOVERY_TRUSTED_IP_HEADER` only after the ingress boundary strips every client-supplied copy and writes one validated IP. Recovery fails closed when that trusted identity is absent or malformed; raw IP values must never be logged or persisted.
  - Recovery responses use a server-controlled, keyed 2.0–2.25 second envelope and bound recovery database work to 750 ms. The recovery RPC performs a fixed bucketed decoy lock/write before customer lookup; the decoy table contains only aggregate counters, never pair hashes, order IDs, emails, or bearer values.
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
