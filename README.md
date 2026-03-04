# Myrivo

Myrivo is a multi-tenant commerce platform for independent makers and small shops.

## Stack

- Frontend: Next.js + TypeScript
- Styling: Tailwind CSS with theme token variables
- Backend: Supabase (Postgres, Auth, Storage)
- Payments: Stripe (Billing + Connect)
- Deployment: Vercel

## Monetization model

- Standard tier: 1.25% + $0.25 per successful order
- Family & friends tier: 0% + $0 (platform admin assigned only)
- Stripe processing fees are always merchant-visible and separate

## Workspace layout

- `apps/web`: web app (merchant dashboard + storefront routes)
- `packages/config`: shared configuration package
- `supabase/`: migrations, seeds, and DB docs

## Quick start

1. `cp .env.example .env.local`
2. Fill in Supabase environment values.
3. Set `STRIPE_STUB_MODE=true` for local-first development.
4. `npm install`
5. `npm run dev`

## Local MVP flow

1. Create an account at `/signup`.
2. Complete onboarding at `/onboarding`.
3. Manage catalog + plans at `/dashboard`.
4. Manage orders at `/dashboard/orders`.
5. Configure profile/branding/domains at `/dashboard/settings`.
6. Test storefront and checkout at `/s/<store-slug>`.

## Merchant capabilities

- Multi-tenant storefront rendering by subdomain or custom domain.
- Merchant onboarding, auth, and protected dashboard.
- Product catalog management with inventory controls and status workflows.
- Product merchandising controls (SKU, featured flag, image URL).
- Promo/discount engine with configurable code rules and checkout application.
- Subscription plan management with configurable platform fees.
- Domain management and branding controls.
- Public storefront with cart, checkout, promo codes, policy/announcement content, and configurable content blocks.
- Order operations with detail drill-down and status management.
- CSV export for orders and reporting workflows.
- Fulfillment workflow states (`unfulfilled`, `processing`, `fulfilled`, `shipped`).
- Inventory movement ledger for post-sale auditability.
- Manual inventory adjustment endpoint/UI that writes ledger events for restock/adjustment actions.
- Insights dashboard with revenue/discount/fee trends and low-stock watchlist.

## Release notes before live Stripe

- Keep `STRIPE_STUB_MODE=true` in local and staging while hardening.
- Apply latest Supabase migrations before QA (`supabase db push`).
- Verify checkout path through `/api/orders/checkout` and order/inventory updates.
- Verify subscription selection flow updates `subscriptions.platform_fee_bps`.
- Final step: switch `STRIPE_STUB_MODE=false` and configure live Stripe keys/webhook.

## Quality checks

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run e2e --workspace=@myrivo/web`

## E2E testing notes

- E2E defaults to your existing local dev server (`http://127.0.0.1:3000`).
- To let Playwright manage its own server, run with:
  - `E2E_MANAGED_SERVER=true npm run e2e --workspace=@myrivo/web`
