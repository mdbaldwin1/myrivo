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
- sets `automatic_tax.liability.account = store.stripe_account_id`

That means Stripe Tax is configured to use the connected seller account's tax liability rather than the platform account's configuration.

What is still incomplete:
- live checkout now blocks when connected-account Stripe Tax setup is not ready
- merchant settings now surface Stripe Tax readiness and missing setup fields
- connected-account tax setup still needs explicit go-live activation gating, not just checkout gating
- checkout still uses one aggregated line item, which is workable for now but not ideal long term

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

## Remaining implementation work

The following work still needs to land before Myrivo can fully claim merchant-owned tax readiness end to end:

1. Add merchant tax readiness checks to onboarding / go-live activation, not just checkout.
2. Expand merchant-facing tax setup surfaces where useful:
   - registration status
   - clearer setup CTAs into Stripe
3. Keep merchant-facing docs/copy aligned with the responsibility model.
4. Verify test-mode and live-mode flows against connected-account tax configuration.

## Test-mode note

The current local Stripe environment may still point at a test platform account with:
- no head office configured
- no default tax code configured
- no tax registrations configured

That is expected while the readiness work is still in progress, but it also means:
- merchant-liable tax is not fully launch-ready until connected-account setup is also enforced at go-live

## Line item caveat

Checkout currently sends one aggregated line item (`<store name> order`) to Stripe.

That is acceptable for early validation, but not ideal long term. Better tax classification will come from:
- itemized line items
- explicit product tax codes
- explicit shipping tax behavior where relevant

This is a follow-up improvement, not the first blocker for moving to merchant-owned liability.

## Operational guidance

Until the readiness and setup enforcement work is complete:
- do **not** assume every connected account has the required registrations and defaults configured at go-live
- rely on checkout gating plus merchant settings visibility, but treat live-launch gating as a remaining follow-up

Once the migration is complete, the operating guidance should be:

> Sellers own tax setup, registrations, and filings.
> Myrivo provides the storefront, checkout, and Stripe Tax integration, but does not take on merchant tax filing responsibility.
