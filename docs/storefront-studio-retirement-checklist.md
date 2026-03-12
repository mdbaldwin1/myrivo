# Storefront Studio Retirement Checklist

This checklist records which legacy builder routes have been retired into Storefront Studio, which routes remain intentionally outside Studio, and which routes have moved into Email Studio.

## Retired Into Storefront Studio

These routes should no longer be treated as primary editing surfaces. They now redirect into Storefront Studio with the matching surface selected.

Canonical Storefront Studio route:

- `/dashboard/stores/[storeSlug]/storefront-studio`

- `/dashboard/stores/[storeSlug]/content-workspace/home`
- `/dashboard/stores/[storeSlug]/content-workspace/products`
- `/dashboard/stores/[storeSlug]/content-workspace/about`
- `/dashboard/stores/[storeSlug]/content-workspace/policies`
- `/dashboard/stores/[storeSlug]/content-workspace/cart`
- `/dashboard/stores/[storeSlug]/content-workspace/order-summary`

## Builder-Owned Settings Moved To Studio

These routes remain present only as handoff pages and should be considered retired as standalone editors.

- `/dashboard/stores/[storeSlug]/store-settings/general`
- `/dashboard/stores/[storeSlug]/store-settings/branding`
- `/dashboard/stores/[storeSlug]/store-settings/shipping`
- `/dashboard/stores/[storeSlug]/store-settings/checkout-experience`

These builder-owned settings now live in Storefront Studio:

- store identity and SEO metadata
- branding/theme tokens and brand assets
- flat-rate shipping offer label and fee
- local pickup offer label and fee
- buyer order note enablement and prompt
- storefront-facing newsletter capture

## Operational Or Mixed Routes That Still Remain

These routes should stay outside the website builder because they are operational or still contain operational ownership.

- `/dashboard/stores/[storeSlug]/store-settings/domains`
- `/dashboard/stores/[storeSlug]/store-settings/team`
- `/dashboard/stores/[storeSlug]/store-settings/integrations`
- `/dashboard/stores/[storeSlug]/store-settings/pickup`

`pickup` remains because it still owns:

- pickup availability rules
- buyer selection mode and radius rules
- location management
- schedule windows
- blackout windows
- buyer-facing operational pickup instructions

## Email Studio Takeover

Transactional templates are now edited in Email Studio:

- `/dashboard/stores/[storeSlug]/email-studio`

Legacy compatibility routes now redirect there:

- `/dashboard/stores/[storeSlug]/content-workspace/emails`
- `/dashboard/content-workspace/emails`
- `/dashboard/stores/[storeSlug]/content-studio/emails`

Ownership split:

- Storefront Studio owns newsletter capture module visibility and subscriber-facing copy
- Email Studio owns sender identity, reply-to config, and transactional subject/body templates

## Navigation Expectations

Current intended navigation shape:

- Store nav entry: `Storefront Studio`
- Canonical Storefront Studio route: `/dashboard/stores/[storeSlug]/storefront-studio`
- Legacy compatibility route: `/dashboard/stores/[storeSlug]/content-workspace` -> `storefront-studio`
- Separate workspace nav entry: `Email Studio`
- Store settings nav:
  - `Overview`
  - `Pickup`
  - `Domains`
  - `Team`
  - `Integrations`

The following should no longer appear as first-class settings nav destinations:

- `General`
- `Branding`
- `Shipping`
- `Checkout Experience`

## Merge Readiness Checks

Before merge, verify all of the following:

- retired content routes redirect to the correct Studio surface
- retired settings routes hand off to Studio instead of exposing duplicate editors
- Storefront Studio still renders and saves builder-owned settings correctly
- pickup operations remain functional outside Studio
- Email Studio route is reachable and legacy email routes redirect to it
- dashboard navigation reflects the new ownership split
