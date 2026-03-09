# Myrivo Architecture and Implementation Plan

## Product Goal

Build a multi-tenant ecommerce platform for small makers that provides:

- Store creation and branding (logo, theme, custom domain)
- Product catalog and inventory management
- Checkout and order management
- Stripe-based payment processing
- Hybrid monetization: free tier with platform transaction fee, paid tiers with reduced or zero fee

## Core Stack

- Frontend: Next.js (TypeScript)
- Backend: Supabase (Postgres, Auth, Storage, Edge Functions)
- Payments: Stripe (Connect + Billing)
- Deployment: Vercel (web app)

## Multi-Tenant Model

- Tenant identified by `store_id` and resolved by subdomain/custom domain.
- All tenant-scoped tables include `store_id`.
- Enforce isolation via Postgres Row-Level Security.
- Public storefront rendering uses domain mapping to locate tenant configuration.

## Suggested Workspace Layout

- `apps/web`: Next.js app (admin + storefront)
- `packages/ui`: shared design system components
- `packages/config`: eslint/tsconfig/shared tooling
- `supabase/`: migrations, seeds, edge functions, policies

## Data Model (Initial)

- `stores`: id, owner_user_id, name, slug, status
- `store_domains`: id, store_id, domain, verified_at, is_primary
- `store_branding`: store_id, logo_url, theme_json
- `products`: id, store_id, title, description, price_cents, inventory_qty, status
- `orders`: id, store_id, customer_email, currency, subtotal_cents, total_cents, status, platform_fee_bps, platform_fee_cents
- `order_items`: id, order_id, product_id, quantity, unit_price_cents
- `subscriptions`: id, store_id, stripe_customer_id, stripe_subscription_id, plan_key, status, platform_fee_bps

## Integrations

### Stripe

- Use Stripe Connect (Standard) for merchant payouts.
- Platform charges subscription via Stripe Billing.
- Keep payment data minimal in DB; store Stripe IDs and status snapshots.
- Webhooks handled by Next.js route handlers and/or Supabase Edge Functions.

### Supabase

- Auth for merchant admin accounts.
- Postgres + RLS for tenant isolation.
- Storage for logos/product media.
- Realtime optional for inventory/order updates later.

### Vercel

- Deploy Next.js app on Vercel.
- Use preview deployments for PRs.
- Production environment wired to Supabase + Stripe secrets.
- Custom domains managed through Vercel project domains and store domain verification.

## Implementation Phases

1. Platform Foundation
- Monorepo scaffolding, CI, lint/typecheck/test baseline
- Supabase project setup and initial migration set
- Auth and tenant bootstrap flow

2. Merchant Admin MVP
- Store profile, branding upload, product CRUD, basic inventory
- Domain setup UX and verification state

3. Storefront + Checkout
- Public storefront by domain/slug
- Cart + checkout session creation
- Stripe payment confirmation and order creation

4. Operations
- Order management UI
- Inventory adjustments and low-stock signals
- Basic analytics (orders, revenue, top products)

5. Billing + Hardening
- Subscription plans and billing portal
- Audit logs, rate limiting, retryable webhooks
- Monitoring and SLO alerts

## Revenue Strategy Recommendation

- Use a hybrid model:
  - Free tier: no monthly fee, platform fee on transactions
  - Paid tiers: monthly subscription with reduced or zero platform fee
- Keep Stripe processing fees separate and transparent in merchant reporting.
- Suggested initial tiers:
  - Free: baseline storefront + checkout, higher platform fee
  - Starter: low monthly fee, reduced platform fee
  - Growth: higher monthly fee, optional zero platform fee
  - Scale: premium monthly fee, zero platform fee, multi-user roles and priority support

## Immediate Next Tasks

1. Initialize project structure (`apps/web`, `packages/*`, `supabase/`).
2. Define first SQL migration with RLS policies for `stores`, `products`, `orders`.
3. Implement auth + store creation flow.
4. Add Stripe test-mode checkout and webhook handling.
5. Configure Vercel project and environment variable matrix.
