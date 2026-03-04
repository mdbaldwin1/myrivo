# Myrivo Project Memory

## Project Overview
Single-tenant e-commerce app. Started as a multi-seller platform, pivoted to single-tenant.
Currently built for owner's sister ("At Home Apothecary" store). Long-term: deployable for
wife/friends to run their own shops.

## Tech Stack
- Next.js (App Router, React 19, Server Components)
- Supabase (PostgreSQL + Auth + RLS)
- Stripe Connect (platform + merchant accounts, 0% platform fee)
- EasyPost (shipping tracking)
- Tailwind CSS + Radix UI (shadcn-style components)
- Vitest (unit) + Playwright (E2E)
- Vercel deployment, npm + Turbo monorepo

## Key Architecture Files
- `apps/web/lib/auth/owner-access.ts` - email allowlist + ownership check
- `apps/web/lib/stores/owner-store.ts` - getOwnedStoreBundle()
- `apps/web/lib/storefront/load-storefront-data.ts` - public storefront data
- `apps/web/lib/storefront/checkout-finalization.ts` - post-Stripe webhook finalization
- `apps/web/lib/shipping/provider.ts` - EasyPost integration
- `apps/web/lib/env.ts` - Zod-validated env with stripeEnvSchema, shippingEnvSchema
- `apps/web/types/database.ts` - Generated Supabase types

## Single-Tenant Config
- `MYRIVO_SINGLE_STORE_SLUG` env var identifies the one store
- `OWNER_ACCESS_EMAILS` env var comma-separated allowlist for dashboard access
- `MYRIVO_ALLOW_PUBLIC_SIGNUP` env var (restrictive by default)

## Database Key Tables
- stores, store_branding, store_settings, store_content_blocks
- products, product_variants, product_option_axes, product_option_values
- orders, order_items, inventory_movements, storefront_checkout_sessions
- promotions, store_customers, audit_events
- user_profiles, store_memberships (owner role only functional)

## Payment Flow
- STRIPE_STUB_MODE=true bypasses Stripe (for testing)
- Live: storefront_checkout_sessions → Stripe Checkout → webhook → stub_checkout_create_paid_order RPC
- Platform fee hardcoded to 0% (single-store mode)

## What's Production-Ready
- Storefront + checkout (origin validation, rate limiting, atomic inventory)
- Product/inventory management
- Order fulfillment flow (pending → packing → shipped → delivered)
- Promo code system (atomic discount calc)
- Stripe Connect integration (minus refunds)

## Key Gaps (as of 2026-03-01)
- No refund API
- Rate limiting is in-memory (not Redis - won't survive multi-instance)
- EasyPost webhook uses query param secret, not signed header
- No customer order history / customer accounts
- No email notifications (post-purchase, shipping updates)
- Promo code double-redemption edge case under concurrency
- No pagination on product list

## User Preferences
- Prefers concise, direct communication
- No emojis
- Focused on practical improvements, not over-engineering
