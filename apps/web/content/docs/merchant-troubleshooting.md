---
slug: merchant-troubleshooting
title: Merchant Troubleshooting
summary: Diagnose common storefront and operations issues without losing track of the workflow or the customer impact.
category: Getting Started
audience: Store owners, admins, and day-to-day operators
lastUpdated: March 2026
owner: Support Operations
reviewCadence: Monthly
reviewBy: 2026-04-30
---

## Start With The Customer Path
When something breaks, start with the customer-visible symptom before changing settings.

Check:

- which route or workflow is failing
- whether the problem is storefront-facing or dashboard-only
- whether the issue affects everyone or one store/user

## Common Areas To Check
Use the closest operational surface before changing unrelated settings.

- Catalog issues: `/dashboard/stores/:storeSlug/catalog`
- Order or fulfillment issues: `/dashboard/stores/:storeSlug/orders`
- Storefront content issues: `/dashboard/stores/:storeSlug/storefront-studio`
- Domain issues: `/dashboard/stores/:storeSlug/store-settings/domains`
- Legal or policy issues: `/dashboard/stores/:storeSlug/store-settings/legal`

## Escalate Cleanly
When you need support, include:

- store slug
- route where the problem appears
- order, product, or review id if relevant
- the exact action you took
- screenshots or console/network evidence when possible

## Related Docs

- `/docs/getting-started`
- `/docs/catalog-and-orders`
- `/docs/domains-and-launch-readiness`
- `/docs/pickup-and-shipping-operations`
- `/docs/refunds-disputes-and-customer-issues`
