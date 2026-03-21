# Pricing Strategy (Current Admin-Managed Model)

## Model

Myrivo currently uses admin-managed billing plans:

- Plans are assigned by platform admins, not self-served by merchants.
- Stores can run without a monthly subscription.
- Each successful order is charged a single Myrivo fee on the full processed order amount.
- Myrivo covers standard Stripe processing costs inside that fee.
- Every paid order records a fee snapshot for payout and reporting auditability.

## Active tiers

- Standard
  - Monthly price: $0
  - Fee: 6.0% + $0.30
  - Intended for normal public storefronts

- Family & Friends
  - Monthly price: $0
  - Fee: 2.9% + $0.30
  - Internal-use tier for low-volume close-circle stores
  - Intended to cover baseline Stripe processing without adding extra Myrivo margin
  - Assigned by platform admins only

## Positioning notes

- Standard is the public-facing plan.
- Family & Friends is an operational exception, not a public pricing tier.
- There is no in-product Stripe Billing subscription flow today.
- Optional future paid tiers should be introduced only when Myrivo is ready to support a broader subscription-based pricing story.

## Stripe implementation notes

- Use Stripe Connect Express for seller payouts.
- Calculate the platform fee against the full processed order amount.
- Persist fee snapshots on each paid order for historical accuracy.
- Use destination charges with application fees consistent with the current Connect configuration.

## Upgrade behavior

- Plan reassignments affect future transactions only by default.
- Historical orders preserve original fee metadata.
- There is no self-serve upgrade, downgrade, billing portal, or subscription billing flow in the current product.
