# Stripe Tax Setup (Merchant-Owned Liability Plan)

Myrivo enables `automatic_tax` on Stripe Checkout sessions in `/api/orders/checkout`.

This document records both:
- the **current implementation**
- the **intended target state**

The intended direction for Myrivo is:

> **Each seller is responsible for their own tax registrations, tax compliance, and filings.**
> Myrivo should support Stripe Tax calculation, but it should not operate as the tax-liable platform account for merchant storefront sales.

References:
- [Checkout Session create API](https://docs.stripe.com/api/checkout/sessions/create)
- [Tax for software platforms](https://docs.stripe.com/tax/tax-for-platforms)
- [Use Stripe Tax with Connect](https://docs.stripe.com/tax/connect)
- [Tax settings API](https://docs.stripe.com/tax/settings-api)
- [Tax settings embedded component](https://docs.stripe.com/connect/supported-embedded-components/tax-settings)
- [Tax registrations embedded component](https://docs.stripe.com/connect/supported-embedded-components/tax-registrations)

## Current state

Today Myrivo:
- creates Checkout Sessions from the **platform Stripe account**
- uses **destination charges** to transfer funds to connected stores
- sets `automatic_tax.enabled=true`
- does **not** set `automatic_tax.liability`

That means Stripe Tax currently uses the **requesting platform account's** tax configuration, not the connected account's configuration.

In other words:
- the current code path behaves like a **platform-liable tax model**
- this does **not** match the intended merchant-owned tax responsibility model

## Chosen direction

Myrivo should migrate to:

### Merchant-owned tax responsibility

For storefront sales:
- the seller is the tax-liable party
- the seller's connected Stripe account owns tax settings and registrations
- Stripe Tax should calculate tax using the connected account's tax setup
- Myrivo should not require the platform operator to maintain merchant tax registrations or file merchant sales taxes

This is the right operating model for Myrivo while it serves independent sellers.

## Target implementation

### Stripe setup target

Each connected seller account should have:
- Stripe Tax enabled
- head office/business address configured
- default product tax code configured
- default shipping tax code configured if shipping is charged
- default tax behavior configured
- required registrations configured on the connected account

### Checkout target

Checkout should continue using destination charges, but tax liability should be assigned to the connected account.

The intended Checkout Session shape is:

```ts
automatic_tax: {
  enabled: true,
  liability: {
    type: "account",
    account: store.stripe_account_id
  }
}
```

That should be used together with the existing destination-charge flow:

```ts
payment_intent_data: {
  transfer_data: {
    destination: store.stripe_account_id
  }
}
```

### Product/platform target

Myrivo should also:
- expose connected-account tax readiness in merchant settings
- block live launch or live payments when merchant tax setup is incomplete
- document clearly that merchants are responsible for registrations, tax compliance, and filings

## Required migration work

The following work is required before Myrivo can honestly claim that sellers handle tax on their own end:

1. Update checkout code to set connected-account tax liability.
2. Add merchant tax readiness checks to onboarding / go-live.
3. Add merchant-facing tax setup surfaces:
   - tax settings status
   - registration status
   - clear setup CTAs
4. Update merchant-facing docs/copy to state the responsibility model clearly.
5. Verify test-mode and live-mode flows against connected-account tax configuration.

## Test-mode note

The current local Stripe environment may still point at a test platform account with:
- no head office configured
- no default tax code configured
- no tax registrations configured

That is expected while the migration is still in progress, but it also means:
- neither platform-liable nor merchant-liable tax is fully ready yet

## Line item caveat

Checkout currently sends one aggregated line item (`<store name> order`) to Stripe.

That is acceptable for early validation, but not ideal long term. Better tax classification will come from:
- itemized line items
- explicit product tax codes
- explicit shipping tax behavior where relevant

This is a follow-up improvement, not the first blocker for moving to merchant-owned liability.

## Operational guidance

Until the code and Stripe setup are migrated:
- do **not** treat the system as merchant-owned tax-ready
- do **not** assume registrations on the connected account are being used at checkout

Once the migration is complete, the operating guidance should be:

> Sellers own tax setup, registrations, and filings.
> Myrivo provides the storefront, checkout, and Stripe Tax integration, but does not take on merchant tax filing responsibility.
