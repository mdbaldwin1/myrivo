---
slug: privacy-rights-and-cookie-operations
title: Privacy Rights and Cookie Operations
summary: Understand how cookie consent, California rights, do-not-sell/share requests, and browser privacy signals are handled.
category: Team
audience: Store owners, support operators, and compliance stakeholders
lastUpdated: March 2026
owner: Compliance Operations
reviewCadence: Monthly
reviewBy: 2026-04-15
---

## Ownership Model

Myrivo owns the privacy infrastructure that has to behave consistently across storefronts:

- cookie consent storage and analytics gating
- browser privacy signal handling, including Global Privacy Control
- shared request-routing and future suppression plumbing

Stores own the storefront-facing policy details and the operational follow-through:

- privacy contact details
- California/privacy addenda
- whether a do-not-sell/share entry point is shown
- manual response handling for store-level privacy requests
- review of explicit opt-out states created from storefront requests

## Shopper Information Architecture

Shoppers should encounter privacy controls in predictable places:

- collection notices at checkout, newsletter signup, and review submission
- store-scoped Privacy Policy and Terms pages
- a dedicated privacy request page for rights requests
- a do-not-sell/share entry point that routes into the privacy request flow when enabled

Global Privacy Control should be honored automatically when present. It is not a setting shoppers have to discover inside the cookie banner.

## Operator Expectations

Open `Store Settings > Legal` to manage:

- privacy contact fields
- California/privacy addenda
- do-not-sell/share visibility
- incoming privacy requests and status updates
- explicit do-not-sell/share states for shopper emails

When a do-not-sell/share request is submitted, Myrivo now keeps both:

- the original request history
- the current explicit opt-out state used for operator follow-through

If the shopper’s browser also sent Global Privacy Control, that context is shown to operators so support can understand why the opt-out was created.

If a shopper asks whether Myrivo honors browser privacy signals, the answer is `yes`: the platform is responsible for honoring supported signals consistently, while the store remains responsible for policy copy and operational response handling.

## Related Docs

- `/docs/legal-governance-and-consent-ops`
- `/docs/store-settings-and-policies`
- `/docs/support-operations-and-escalation`
