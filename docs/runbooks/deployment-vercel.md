# Vercel Deployment Runbook

## Required accounts

- Vercel project (production + preview)
- Supabase project
- Stripe account (Billing + Connect enabled)

## Environment variables (Vercel)

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `MYRIVO_SINGLE_STORE_SLUG`
- `SHIPPING_PROVIDER`
- `EASYPOST_API_KEY` (when using EasyPost)
- `SHIPPING_WEBHOOK_SECRET`

## GitHub Actions secrets (for automated deploy workflow)

- `VERCEL_TOKEN`

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

## Post-deploy route check

Validate the most important production routes after deploy:

- `/`
- `/pricing`
- `/signup`
- `/dashboard`
- `/dashboard/admin`
- `/s/:storeSlug`
- `/checkout`
