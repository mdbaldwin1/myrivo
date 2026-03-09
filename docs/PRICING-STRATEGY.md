# Pricing Strategy (Hybrid)

## Model

Myrivo uses a hybrid model:

- Free plan: no monthly subscription, higher platform fee on each transaction.
- Paid plans: monthly subscription with reduced or zero platform fee.

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

- Use Stripe Connect for merchant payouts.
- Persist `platform_fee_bps` on `subscriptions`.
- On order payment, calculate and store:
  - `orders.platform_fee_bps`
  - `orders.platform_fee_cents`
- Use Stripe transfer + application fee patterns consistent with Connect account type.

## Upgrade behavior

- Plan changes affect future transactions only by default.
- Historical orders preserve original fee metadata.
- Optional future enhancement: immediate fee changes with prorated subscription billing.
