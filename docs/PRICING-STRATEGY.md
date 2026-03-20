# Pricing Strategy (Current Admin-Managed Model)

## Model

Myrivo currently uses admin-managed billing plans:

- Plans are assigned by platform admins, not self-served by merchants.
- Stores can run on transaction-fee-only pricing.
- Some plans may include a monthly base price commercially, but there is no in-product Stripe Billing subscription flow today.
- Platform fee math is still captured per order for auditability.

Stripe card processing fees are separate and always visible to merchants.

## Suggested initial tiers

- Free
  - Monthly price: $0
  - Platform fee: 2.0% (`200` bps)
- Starter
  - Monthly price: $19
  - Platform fee: 1.0% (`100` bps)
- Growth
  - Monthly price: $49
  - Platform fee: 0.5% (`50` bps)
- Scale
  - Monthly price: $99
  - Platform fee: 0% (`0` bps)

## Stripe implementation notes

- Use Stripe Connect Express for merchant payouts.
- Persist fee snapshots on each order and checkout session, not on Stripe subscriptions.
- On order payment, calculate and store:
  - `orders.platform_fee_bps`
  - `orders.platform_fee_cents`
- Use Stripe transfer + application fee patterns consistent with Connect account type.

## Upgrade behavior

- Plan reassignments affect future transactions only by default.
- Historical orders preserve original fee metadata.
- There is no self-serve upgrade, downgrade, billing portal, or subscription billing flow in the current product.
- Optional future enhancement: add a true subscription-billing layer only if Myrivo decides to sell monthly plans directly through Stripe.
