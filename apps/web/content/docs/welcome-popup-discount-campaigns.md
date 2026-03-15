---
slug: welcome-popup-discount-campaigns
title: Welcome Popup Discount Campaigns
summary: Configure the first-visit email popup that captures marketing consent and emails a welcome discount code.
category: Team
audience: Store owners, merchandisers, and growth operators
lastUpdated: March 2026
owner: Growth Operations
reviewCadence: Monthly
reviewBy: 2026-04-15
---

## What It Does

The welcome popup is a storefront campaign that:

- appears to eligible first-time visitors on public storefront pages
- captures marketing-email consent
- emails the shopper a configured discount code after signup

This keeps the storefront experience promotional without exposing the code before the shopper opts in.

## Where It Lives

Configure the campaign in `Storefront Studio` on the `Home` editor panel under `Welcome popup campaign`.

Use `Promotions` to create the actual discount code first, then select that promotion inside Studio.

## What Merchants Can Configure

The popup is intentionally structured, not fully freeform. Merchants can control:

- whether the popup is enabled
- the selected promotion
- headline and body copy
- CTA label
- email input placeholder
- display delay
- redisplay window after dismissal
- an optional supporting image

The popup always inherits the storefront theme so it remains visually consistent with the rest of the storefront.

## Guardrails

- never shows on cart or checkout
- only works when newsletter capture is enabled
- requires a configured promotion
- stores signup source metadata as `storefront_welcome_popup`
- suppresses repeat display after a successful subscription on the same device/browser

## Related Docs

- `/docs/marketing-email-compliance-and-consent`
- `/docs/promotions-and-subscribers`
