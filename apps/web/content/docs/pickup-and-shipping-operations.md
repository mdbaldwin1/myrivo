---
slug: pickup-and-shipping-operations
title: Pickup and Shipping Operations
summary: Configure fulfillment options, run day-to-day pickup and shipping workflows, and handle operational exceptions without losing customer clarity.
category: Operations
audience: Store owners, admins, and fulfillment staff
lastUpdated: March 2026
owner: Merchant Education
reviewCadence: Quarterly
reviewBy: 2026-06-30
---

## Before You Turn Fulfillment On
Confirm your store can actually support the fulfillment method you are enabling before customers see it in checkout.

- Pickup needs real locations, hours, blackout dates, and lead-time rules
- Shipping needs clear policy copy, delivery expectations, and packaging readiness
- Storefront messaging should match the operational setup customers will encounter

## Pickup Workflow
Use Store Settings > Pickup for operational configuration and the Storefront Studio cart controls for buyer-facing pickup presentation.

For live orders:

- review pickup location and window directly in the order flyout
- use the pickup override flow only when the store truly cannot honor the customer-selected slot
- document the reason any time pickup details are changed

## Shipping Workflow
Use Orders to move shipped orders through tracking and fulfillment states. Treat shipping notices as customer-trust events, not just internal status changes.

When preparing to ship:

- verify inventory and fulfillment state before generating labels
- confirm tracking details are correct before notifying the customer
- use delay communications when the original ship expectation cannot be met

## Shipping Delay Handling
When the original shipping expectation cannot be met, the store should treat the order as a customer expectation workflow, not just an internal ops problem.

The intended workflow is:

1. mark the order as delayed from the order detail surface
2. record the reason and revised estimated ship date
3. choose the customer path:
   - notify only
   - request delay approval
   - offer cancel or refund
4. send the customer to the order page for the response path when approval or cancellation input is needed
5. make sure the outcome is visible in the order timeline and support history

Merchants should avoid handling delayed shipments through ad hoc email alone. Delay decisions should stay attached to the order so support, audit, and refund follow-up stay clear.

Your shipping policy should also explain what customers should expect if a promised ship date changes, including whether the store may ask them to approve a revised date or request cancellation.

## Related Docs

- `/docs/catalog-and-orders`
- `/docs/storefront-analytics-and-reporting`
- `/docs/merchant-troubleshooting`
