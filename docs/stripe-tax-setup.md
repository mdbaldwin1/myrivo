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

What is implemented today:
- live checkout blocks when a store chooses `Stripe Tax` and the connected-account Stripe Tax setup is not ready
- merchant settings surface Stripe Tax readiness and missing setup fields
- merchant settings include embedded Stripe Tax settings and tax registrations components for connected accounts
- stores must make an explicit tax decision before launch:
  - `Stripe Tax`
  - `Seller-attested no-tax`
- seller-attested no-tax is warning-backed and auditable, but it does **not** mean Myrivo determined the seller has no tax obligation
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
- require an explicit tax decision before launch
- block live launch or live payments when a store chooses Stripe Tax and merchant tax setup is incomplete
- document clearly that merchants are responsible for registrations, tax compliance, and filings

## Tax decision policy

Myrivo now supports two launch paths:

1. `Stripe Tax`
- Seller configures tax settings and registrations on their connected Stripe account.
- Myrivo uses the connected account's Stripe Tax setup at checkout.
- This is the preferred and safer default path.

2. `Seller-attested no-tax`
- Seller explicitly acknowledges that Myrivo does not provide tax advice.
- Seller confirms they are responsible for determining whether they must register, collect, remit, and file taxes.
- Myrivo records the acknowledgement timestamp, actor, and note on the store record.

Important boundaries:
- Myrivo does **not** determine that a seller is exempt from tax obligations.
- Myrivo does **not** recommend the no-tax path as generally compliant.
- The no-tax path exists to avoid forcing immediate Stripe Tax setup for sellers who are making their own compliance decision.

## Remaining implementation work

The following work still needs to land before Myrivo can fully claim merchant-owned tax readiness end to end:

1. Verify test-mode and live-mode flows against connected-account tax configuration.
2. Decide whether seller-attested no-tax stores should trigger extra admin review/flagging before launch.
3. Consider future follow-up improvements like itemized Stripe line items and richer tax-code controls.

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

Current operating guidance:

> Sellers own tax setup, registrations, and filings.
> Myrivo provides the storefront, checkout, Stripe Tax integration, and an auditable no-tax attestation path, but does not take on merchant tax filing responsibility or make compliance determinations for sellers.
