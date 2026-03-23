# Environment Variable Matrix

This project uses a mix of required runtime env vars, optional feature/integration vars, and deploy-only secrets.
The source of truth for validated runtime env loading is [`apps/web/lib/env.ts`](/Users/mbaldwin/Myrivo/myrivo/apps/web/lib/env.ts), but some optional flags are still read directly from `process.env`, so this matrix covers both.

## Required in production

These are the minimum app env vars for a real production deployment:

- `NEXT_PUBLIC_APP_URL`
  - Canonical app origin, for example `https://www.myrivo.app`
- `MYRIVO_PUBLIC_APP_URL`
  - Canonical public origin for externally emailed links when app actions may be triggered from local/dev
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Required for local development

- `NEXT_PUBLIC_APP_URL`
  - Usually `http://localhost:3000`
- `MYRIVO_PUBLIC_APP_URL`
  - Recommended if local actions can send real emails; typically `https://www.myrivo.app`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Recommended local defaults:

- `MYRIVO_SINGLE_STORE_SLUG`
- `STRIPE_STUB_MODE=true` if you want to avoid live Stripe credentials locally
- `MYRIVO_ONBOARDING_AI_PROVIDER=deterministic` unless you are actively testing OpenAI-backed onboarding

## Required when the related feature is enabled

### Onboarding AI

- `OPENAI_API_KEY`
  - Required if `MYRIVO_ONBOARDING_AI_PROVIDER=openai`
- `MYRIVO_ONBOARDING_AI_PROVIDER`
  - `deterministic` or `openai`
- `MYRIVO_ONBOARDING_AI_MODEL`
  - Optional override; defaults to `gpt-5-mini`

### Email delivery

- `RESEND_API_KEY`
  - Required to actually send transactional/platform emails through Resend
- `MYRIVO_PUBLIC_APP_URL`
  - Recommended canonical public origin for invite/order/marketing email links when the app is run outside production
- `MYRIVO_EMAIL_PROVIDER`
  - Currently `resend`
- `MYRIVO_EMAIL_FROM`
  - Default sender identity
- `MYRIVO_EMAIL_PLATFORM_FROM`
  - Optional platform-specific sender override
- `MYRIVO_EMAIL_REPLY_TO`
  - Optional default reply-to address
- `MYRIVO_EMAIL_BRANDED_LOCAL_PART`
  - Optional branded local-part fallback, defaults to `orders`
- `MYRIVO_BRANDED_EMAIL_POLICY`
  - `disabled`, `allowlist`, or `all`
- `MYRIVO_BRANDED_EMAIL_STORE_IDS`
  - Comma-separated store IDs when allowlisting branded sending
- `MYRIVO_ORDER_ALERT_EMAILS`
  - Optional comma-separated alert recipients

### Stripe / payments

- `STRIPE_SECRET_KEY`
  - Required for live payment and connect flows
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - Required for Stripe Connect embedded components like seller tax setup
- `STRIPE_WEBHOOK_SECRET`
  - Required for Stripe webhook verification
- `STRIPE_STUB_MODE`
  - Local/testing convenience only; keep `false` in production

### Shipping

- `SHIPPING_ALLOW_QUERY_TOKEN`
  - Optional legacy/simple auth token
- `SHIPPING_WEBHOOK_SIGNING_SECRET`
  - Required if signed webhook verification is enabled
- `SHIPPING_WEBHOOK_REQUIRE_SIGNATURE`
  - `true`/`false`
- `SHIPPING_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS`
  - Signature freshness tolerance

### Reviews

- `REVIEWS_ROLLOUT_STORE_SLUGS`
  - Optional comma-separated allowlist
- `REVIEWS_MAX_SUBMISSIONS_PER_IP_PER_HOUR`
- `REVIEWS_MAX_SUBMISSIONS_PER_EMAIL_PER_DAY`
- `REVIEWS_BLOCKED_TERMS`
- `REVIEWS_MEDIA_MAX_IMAGES_PER_REVIEW`
- `REVIEWS_MEDIA_MAX_FILE_SIZE_BYTES`
- `REVIEWS_MEDIA_MAX_WIDTH`
- `REVIEWS_MEDIA_MAX_HEIGHT`
- `STOREFRONT_REVIEW_SCHEMA_MIN_COUNT`
- `STOREFRONT_REVIEW_SCHEMA_MAX_RECENT`

### Notifications / cron

- `NOTIFICATIONS_CRON_SECRET`
  - Required to secure `/api/notifications/digest/weekly`

### Vercel domain automation

- `VERCEL_API_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_TEAM_ID`

These are only needed if the app itself is calling Vercel domain APIs from runtime/admin flows. They are not required just to host the app on Vercel.

## CI / deploy-only secrets

These are not general app runtime vars, but they matter for automated delivery:

### GitHub Actions CI

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `E2E_OWNER_EMAIL`
- `E2E_OWNER_PASSWORD`

### GitHub Actions deploy workflow

- `VERCEL_TOKEN`

## Local / E2E-only vars

- `E2E_OWNER_EMAIL`
- `E2E_OWNER_PASSWORD`
- `E2E_ALLOW_OWNER_PASSWORD_RESET`
- `E2E_BASE_URL`
- `E2E_PORT`
- `E2E_MANAGED_SERVER`

## Notes

- Keep `SUPABASE_SERVICE_ROLE_KEY`, Stripe secrets, Resend keys, and Vercel API tokens server-only.
- `NEXT_PUBLIC_APP_URL` should match the real deployed origin in production, and the Supabase auth redirect allowlist should include its callback URL.
- `MYRIVO_PUBLIC_APP_URL` lets local/dev runtime actions still generate public-facing email links without pointing recipients at `localhost`.
- `MYRIVO_SINGLE_STORE_SLUG` is a fallback/default runtime slug, not the source of truth for store ownership.
- Shipping provider credentials and per-store webhook secrets live in `store_integrations`, not deployment env vars.
- `.env.example` is now aligned with the current runtime surface; use it as the starting point for local and production env setup.
